"""
Chat route — the main AI pipeline for buyer conversations.
POST /chat/{org_slug}
V3: Explicit Criteria Verification Pipeline
"""

import re
import uuid
import json
from collections import defaultdict
from datetime import datetime, timezone
from time import time

from fastapi import APIRouter, HTTPException, Request, status

from config import settings
from models.schemas import ChatMessageRequest, ChatMessageResponse, ResourceServed, QualificationData
from supabase_client import get_supabase
from services.extraction import extract_qualification_data
from services.persona import detect_persona
from services.kb_retrieval import query_kb
from services.llm import generate_reply
from services.pacing import (
    fire_slack_webhook,
    fire_generic_webhook,
)

router = APIRouter()

# ---------------------------------------------------------------------------
# Rate limiter
# ---------------------------------------------------------------------------
_rate_limits: dict[str, list[float]] = defaultdict(list)
RATE_LIMIT_MAX = 30
RATE_LIMIT_WINDOW = 3600  # seconds


def _check_rate_limit(session_id: str) -> None:
    now = time()
    timestamps = _rate_limits[session_id]
    _rate_limits[session_id] = [t for t in timestamps if now - t < RATE_LIMIT_WINDOW]
    if len(_rate_limits[session_id]) >= RATE_LIMIT_MAX:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Maximum 30 messages per hour per session.",
        )
    _rate_limits[session_id].append(now)


@router.post("/{org_slug}", response_model=ChatMessageResponse)
async def chat_with_org(org_slug: str, body: ChatMessageRequest, request: Request):
    import logging
    logger = logging.getLogger(__name__)

    sb = get_supabase()

    # 1. Resolve org by slug
    org_result = sb.table("orgs").select("id, name").eq("slug", org_slug).execute()
    if not org_result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organisation not found.")

    org = org_result.data[0]
    org_id = org["id"]
    org_name = org["name"]

    # 2. Fetch session and lead state
    session_id = body.session_id or str(uuid.uuid4())
    _check_rate_limit(session_id)

    message = re.sub(r"<[^>]*>", "", body.message.strip())

    lead_result = sb.table("leads").select("*").eq("session_id", session_id).execute()

    if lead_result.data:
        lead = lead_result.data[0]
        conversation = lead.get("conversation") or []
        qualification_data = lead.get("qualification_data") or {}
        is_qualified = lead.get("is_qualified")
        persona = lead.get("persona")
        calendly_shown = lead.get("calendly_shown", False)
        resources_served = lead.get("resources_served") or []
    else:
        lead_id = str(uuid.uuid4())
        lead = {
            "id": lead_id,
            "org_id": org_id,
            "session_id": session_id,
            "persona": None,
            "qualification_data": {},
            "is_qualified": None,
            "resources_served": [],
            "conversation": [],
            "crm_filed": False,
            "calendly_shown": False,
            "intent_score": 0,
            "intent_state": "Exploring",
            "signals": []
        }
        sb.table("leads").insert(lead).execute()
        conversation = []
        qualification_data = {}
        is_qualified = None
        persona = None
        calendly_shown = False
        resources_served = []

    now_str = datetime.now(timezone.utc).isoformat()
    conversation.append({"role": "user", "content": message, "timestamp": now_str})

    # 3. Persona
    if persona is None and len([t for t in conversation if t["role"] == "user"]) <= 3:
        try:
            persona = await detect_persona([t["content"] for t in conversation if t["role"] == "user"], settings.groq_api_key)
        except Exception:
            persona = "Casual explorer"

    # 4. Extract explicit criteria
    new_qdata = await extract_qualification_data(conversation, settings.groq_api_key)
    
    # Merge existing knowns with new discoveries, giving precedence to new if not null
    for k, v in new_qdata.items():
        if v is not None:
            qualification_data[k] = v

    # 5. Evaluate criteria: size >= 50 AND timeline <= 3 is Qualified
    was_qualified_before = is_qualified
    is_qualified = None
    
    # Check if we have size and timeline
    size = qualification_data.get("company_size")
    timeline = qualification_data.get("timeline_months")
    
    # Ensure they are ints before comparing
    if size is not None and timeline is not None:
        try:
            if int(size) >= 50 and int(timeline) <= 3:
                is_qualified = True
            else:
                is_qualified = False
        except ValueError:
             pass # Failed to parse as numbers, stay None

    # 6. Retrieve from knowledge base
    # If unqualified, we want to recommend 3 resources to educate.
    # Otherwise, returning 1 is enough for Q&A.
    kb_resources = []
    chroma_client = request.app.state.chroma_client
    embedding_model = request.app.state.embedding_model
    
    n_results = 3 if is_qualified is False else 1

    if chroma_client and embedding_model:
        kb_resources = query_kb(message, org_id, embedding_model, chroma_client, n_results=n_results)

    # 7. Generate rule-controlled response
    try:
        reply = await generate_reply(
            message=message,
            conversation_history=conversation,
            is_qualified=is_qualified,
            qualification_data=qualification_data,
            persona=persona,
            kb_resources=kb_resources,
            org_name=org_name,
            groq_api_key=settings.groq_api_key,
        )
    except Exception as exc:
        logger.error(f"LLM generate_reply FAILED: {type(exc).__name__}: {exc}")
        reply = "I apologize, but I'm having trouble generating a response right now."

    conversation.append({"role": "assistant", "content": reply, "timestamp": datetime.now(timezone.utc).isoformat()})

    # Log resources
    for res in kb_resources:
        # only keep track of distinct resources
        if not any(r["source_file"] == res["source_file"] for r in resources_served):
            resources_served.append({
                "title": res["title"],
                "source_file": res["source_file"],
                "relevance_score": res.get("relevance_score", 0),
            })
            
    # Format a primary resource for backward compatibility
    primary_resource = None
    if kb_resources:
        primary_resource = ResourceServed(
            title=kb_resources[0]["title"],
            source_file=kb_resources[0]["source_file"],
            relevance_score=kb_resources[0].get("relevance_score", 0),
            excerpt=kb_resources[0].get("excerpt", ""),
        )

    # 8. Trigger Tool Orchestrations
    integration_result = sb.table("integrations").select("*").eq("org_id", org_id).execute()
    integration = integration_result.data[0] if integration_result.data else None
    
    show_calendly = calendly_shown
    calendly_link = integration.get("calendly_link") if integration else None

    # Trigger tools only if newly qualified this turn
    if is_qualified is True:
        show_calendly = True if calendly_link else False
        
        if not was_qualified_before and integration:
             lead_data = {
                 "persona": persona,
                 "qualification_data": qualification_data,
                 "is_qualified": True,
                 "session_id": session_id,
                 "updated_at": now_str,
                 # provide fallbacks for webhook expectations
                 "intent_score": 100,
                 "intent_state": "Decision-Ready",
             }
             
             if integration.get("slack_webhook"):
                 await fire_slack_webhook(lead_data, integration["slack_webhook"])
             if integration.get("webhook_url"):
                 await fire_generic_webhook(lead_data, integration["webhook_url"])


    # 9. Log Intent History / Checklist state
    try:
        turn_number = len([t for t in conversation if t["role"] == "user"])
        sb.table("intent_history").insert({
            "lead_id": lead["id"],
            "turn_number": turn_number,
            "score_before": 0, # maintained for backward compat schema
            "score_after": 100 if is_qualified else 0,
            "signals": list(qualification_data.keys()),
        }).execute()
    except Exception as exc:
        logger.warning(f"Interaction log insert failed (non-fatal): {exc}")

    # 10. Save Lead
    update_data = {
        "qualification_data": qualification_data,
        "is_qualified": is_qualified,
        "persona": persona,
        "resources_served": resources_served,
        "conversation": conversation,
        "calendly_shown": show_calendly,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        # Backwards compatible state
        "intent_score": 100 if is_qualified else 0,
        "intent_state": "Decision-Ready" if is_qualified else "Exploring"
    }

    sb.table("leads").update(update_data).eq("session_id", session_id).execute()

    qdata_model = QualificationData(**qualification_data)

    return ChatMessageResponse(
        reply=reply,
        session_id=session_id,
        intent_score=100 if is_qualified else 0,
        intent_state="Decision-Ready" if is_qualified else "Exploring",
        persona=persona,
        resource=primary_resource,
        show_calendly=show_calendly,
        calendly_link=calendly_link if show_calendly else None,
        qualification_data=qdata_model,
        is_qualified=is_qualified
    )
