"""
Chat route — the main AI pipeline for buyer conversations.
V4: Explicit Criteria Verification (Configurable)
"""

import re
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from time import time

from fastapi import APIRouter, HTTPException, Request, status

from config import settings
from models.schemas import ChatMessageRequest, ChatMessageResponse, QualificationChecklist, KBResource
from supabase_client import get_supabase
from services.qualification import extract_and_evaluate, load_qualification_criteria
from services.persona import detect_persona
from services.kb_retrieval import query_kb, query_kb_resources
from services.llm import generate_reply
from services.tools import draft_confirmation_email, generate_meeting_proposal
from services.pacing import fire_slack_webhook, fire_generic_webhook

router = APIRouter()

_rate_limits: dict[str, list[float]] = defaultdict(list)
RATE_LIMIT_MAX = 30
RATE_LIMIT_WINDOW = 3600

def _check_rate_limit(session_id: str) -> None:
    now = time()
    timestamps = _rate_limits[session_id]
    _rate_limits[session_id] = [t for t in timestamps if now - t < RATE_LIMIT_WINDOW]
    if len(_rate_limits[session_id]) >= RATE_LIMIT_MAX:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded.",
        )
    _rate_limits[session_id].append(now)


@router.post("/{org_slug}", response_model=ChatMessageResponse)
async def chat_with_org(org_slug: str, body: ChatMessageRequest, request: Request):
    import logging
    logger = logging.getLogger(__name__)

    sb = get_supabase()

    org_result = sb.table("orgs").select("id, name").eq("slug", org_slug).execute()
    if not org_result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    org = org_result.data[0]
    org_id = org["id"]
    org_name = org["name"]

    session_id = body.session_id or str(uuid.uuid4())
    _check_rate_limit(session_id)
    message = re.sub(r"<[^>]*>", "", body.message.strip())

    lead_result = sb.table("leads").select("*").eq("session_id", session_id).execute()

    if lead_result.data:
        lead = lead_result.data[0]
        conversation = lead.get("conversation") or []
        qualification_checklist = lead.get("qualification_checklist") or {}
        qualification_status = lead.get("qualification_status", "collecting")
        persona = lead.get("persona")
    else:
        lead_id = str(uuid.uuid4())
        lead = {
            "id": lead_id,
            "org_id": org_id,
            "session_id": session_id,
            "persona": None,
            "qualification_checklist": {},
            "qualification_status": "collecting",
            "conversation": [],
            "intent_score": 0,
            "intent_state": "Exploring",
            "signals": []
        }
        sb.table("leads").insert(lead).execute()
        conversation = []
        qualification_checklist = {}
        qualification_status = "collecting"
        persona = None

    now_str = datetime.now(timezone.utc).isoformat()
    conversation.append({"role": "user", "content": message, "timestamp": now_str})

    if persona is None and len([t for t in conversation if t["role"] == "user"]) <= 3:
        try:
            persona = await detect_persona([t["content"] for t in conversation if t["role"] == "user"], settings.groq_api_key)
        except Exception:
            persona = "Casual explorer"

    # Evaluation
    was_qualified = (qualification_status == "qualified")
    
    # We pass the conversation context to extraction model
    new_checklist, new_status = await extract_and_evaluate(org_id, conversation, settings.groq_api_key)

    # Calculate missing fields based on Org rules
    req_fields, _ = load_qualification_criteria(org_id)
    missing = [f for f in req_fields if not new_checklist.get(f)]

    # Retrieval + Tools
    drafted_email = None
    meeting_link = None
    resources = []
    structured_res = []

    chroma = request.app.state.chroma_client
    embed = request.app.state.embedding_model

    if new_status == "unqualified":
        # Pull up to 3 structured KB links for email out
        kb_data = query_kb_resources(org_id, count=3)
        for r in kb_data:
            structured_res.append(KBResource(title=r["title"], url=r["url"], type=r["type"], description=r.get("description", "")))
    elif new_status == "qualified":
        integration_result = sb.table("integrations").select("*").eq("org_id", org_id).execute()
        integration = integration_result.data[0] if integration_result.data else None
        cal_url = integration.get("calendly_link") if integration else None
        
        meeting_link = generate_meeting_proposal(cal_url)
        drafted_email = await draft_confirmation_email(new_checklist, settings.groq_api_key)
        
        if not was_qualified and integration:
             lead_data = {
                 "persona": persona,
                 "qualification_status": new_status,
                 "checklist": new_checklist,
                 "session_id": session_id,
                 "updated_at": now_str,
                 # fallbacks for webhook expectations
                 "intent_score": 100,
             }
             if integration.get("slack_webhook"):
                 await fire_slack_webhook(lead_data, integration["slack_webhook"])
             if integration.get("webhook_url"):
                 await fire_generic_webhook(lead_data, integration["webhook_url"])
    else:
        # Collecting - can still hit text knowledge base
        if chroma and embed:
            resources = query_kb(message, org_id, embed, chroma, n_results=1)

    try:
        reply = await generate_reply(
            message=message,
            conversation_history=conversation,
            qualification_status=new_status,
            missing_fields=missing,
            persona=persona,
            kb_resources_text=resources,
            structured_resources=[s.model_dump() for s in structured_res],
            org_name=org_name,
            groq_api_key=settings.groq_api_key,
        )
    except Exception as exc:
        logger.error(f"LLM Reply failed: {exc}")
        reply = "I apologize, but I'm having trouble generating a response."

    conversation.append({"role": "assistant", "content": reply, "timestamp": datetime.now(timezone.utc).isoformat()})

    update_data = {
        "qualification_checklist": new_checklist,
        "qualification_status": new_status,
        "persona": persona,
        "conversation": conversation,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        # For backward compatibility with existing data schemas in client
        "intent_score": 100 if new_status == "qualified" else 0,
        "intent_state": "Decision-Ready" if new_status == "qualified" else "Exploring",
    }
    sb.table("leads").update(update_data).eq("session_id", session_id).execute()

    q_checklist_model = QualificationChecklist(**new_checklist)

    return ChatMessageResponse(
        reply=reply,
        session_id=session_id,
        qualification_status=new_status,
        qualification_checklist=q_checklist_model,
        drafted_email=drafted_email,
        meeting_link=meeting_link,
        resources=structured_res,
        intent_score=100 if new_status == "qualified" else 0,
        persona=persona
    )
