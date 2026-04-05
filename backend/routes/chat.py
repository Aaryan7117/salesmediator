"""
Chat route — the main AI pipeline for buyer conversations.

POST /chat/{org_slug} — public endpoint, rate-limited, no auth required.

Pipeline per message (v3 — Explicit Criteria Verification):
1. Resolve org by slug
2. Create or fetch session (lead)
3. Extract qualification fields (LLM + regex)
4. Evaluate against org-configurable criteria
5. Detect persona (turns 1–3 only)
6. Memory: generate summary if needed
7. Retrieve KB context (multi-result with citations)
8. Generate AI reply with qualification-aware guidance
9. Criteria routing gate:
   - Qualified → Draft email + schedule meeting + fire notifications
   - Unqualified → Serve 2-5 KB resources with links
   - Collecting → Keep asking naturally
10. Record qualification history
11. Update lead in Supabase
12. Return response
"""

import re
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from time import time

from fastapi import APIRouter, HTTPException, Request, status

from config import settings
from models.schemas import (
    ChatMessageRequest,
    ChatMessageResponse,
    ResourceServed,
    QualificationChecklist,
    KBResource,
)
from supabase_client import get_supabase
from services.qualification import extract_qualification
from services.persona import detect_persona
from services.kb_retrieval import query_kb, query_kb_resources, get_org_qualification_criteria
from services.llm import generate_reply
from services.tools import (
    draft_confirmation_email,
    send_email_via_emailjs,
    generate_meeting_proposal,
    fire_qualified_lead_notifications,
)

router = APIRouter()

# ---------------------------------------------------------------------------
# In-memory rate limiter: max 30 messages per session per hour
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
    """
    Main buyer chat endpoint. No auth required — public-facing.
    V3: Explicit criteria verification with qualification checklist.
    """
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

    # 2. Create or fetch session
    session_id = body.session_id or str(uuid.uuid4())
    _check_rate_limit(session_id)

    # Sanitize message
    message = re.sub(r"<[^>]*>", "", body.message.strip())

    lead_result = sb.table("leads").select("*").eq("session_id", session_id).execute()

    if lead_result.data:
        lead = lead_result.data[0]
        conversation = lead.get("conversation") or []
        resources_served = lead.get("resources_served") or []
        persona = lead.get("persona")
        calendly_shown = lead.get("calendly_shown", False)
        crm_filed = lead.get("crm_filed", False)
        # Load existing qualification data
        existing_checklist = lead.get("qualification_checklist") or {}
        prev_status = lead.get("qualification_status", "collecting")
    else:
        # New session — create lead
        lead_id = str(uuid.uuid4())
        lead = {
            "id": lead_id,
            "org_id": org_id,
            "session_id": session_id,
            "persona": None,
            "intent_score": 0,
            "intent_state": "Exploring",
            "signals": [],
            "resources_served": [],
            "conversation": [],
            "crm_filed": False,
            "calendly_shown": False,
            "qualification_status": "collecting",
            "qualification_checklist": {},
        }
        sb.table("leads").insert(lead).execute()
        conversation = []
        resources_served = []
        persona = None
        calendly_shown = False
        crm_filed = False
        existing_checklist = {}
        prev_status = "collecting"

    # Add buyer message to conversation
    now_str = datetime.now(timezone.utc).isoformat()
    conversation.append({"role": "user", "content": message, "timestamp": now_str})

    # 3. Load org-specific qualification criteria
    org_criteria = get_org_qualification_criteria(org_id, sb)

    # 4. Extract qualification fields (LLM + regex)
    updated_checklist, qual_status, missing_fields = await extract_qualification(
        message=message,
        conversation=conversation,
        existing_checklist=existing_checklist,
        groq_api_key=settings.groq_api_key,
        org_criteria=org_criteria,
    )

    # 5. Detect persona (first 3 user messages only)
    user_messages = [t["content"] for t in conversation if t["role"] == "user"]
    if persona is None and len(user_messages) <= 3:
        try:
            persona = await detect_persona(user_messages, settings.groq_api_key)
        except Exception:
            persona = "Casual explorer"

    # 6. Memory: generate summary if conversation is long
    conv_summary = None
    try:
        from services.memory import ConversationMemory
        if ConversationMemory.should_summarize(conversation):
            summary_result = await ConversationMemory.generate_summary(
                conversation, settings.groq_api_key
            )
            if summary_result:
                conv_summary = summary_result.get("summary", "")
                logger.info(f"Conv summary: {conv_summary[:60]}...")
    except Exception as exc:
        logger.warning(f"Memory summary failed (non-fatal): {exc}")

    # 7. Retrieve KB context for product questions
    kb_resource = None
    chroma_client = request.app.state.chroma_client
    embedding_model = request.app.state.embedding_model

    if chroma_client and embedding_model:
        kb_resource = query_kb(message, org_id, embedding_model, chroma_client)

    resource_response = None
    if kb_resource:
        resource_response = ResourceServed(
            title=kb_resource["title"],
            source_file=kb_resource["source_file"],
            relevance_score=kb_resource["relevance_score"],
            excerpt=kb_resource["excerpt"],
        )
        resources_served.append({
            "title": kb_resource["title"],
            "source_file": kb_resource["source_file"],
            "relevance_score": kb_resource["relevance_score"],
        })

    # 8. Criteria-driven routing — prepare tools
    drafted_email = None
    meeting_link = None
    meeting_proposal = None
    kb_resources_list = []

    # Fetch integrations
    integration_result = sb.table("integrations").select("*").eq("org_id", org_id).execute()
    integration = integration_result.data[0] if integration_result.data else None
    calendly_link = integration.get("calendly_link") if integration else None

    if qual_status == "qualified" and prev_status != "qualified":
        # Just qualified! Trigger tools
        logger.info(f"🟢 Lead QUALIFIED: {session_id[:12]}...")

        # Draft confirmation email
        try:
            drafted_email = await draft_confirmation_email(
                checklist=updated_checklist,
                org_name=org_name,
                groq_api_key=settings.groq_api_key,
            )
        except Exception as exc:
            logger.warning(f"Email drafting failed (non-fatal): {exc}")

        # Actually send the email via EmailJS
        if drafted_email:
            try:
                await send_email_via_emailjs(
                    checklist=updated_checklist,
                    email_body=drafted_email,
                    org_name=org_name,
                )
            except Exception as exc:
                logger.warning(f"EmailJS send failed (non-fatal): {exc}")

        # Generate meeting proposal
        meeting_proposal = generate_meeting_proposal(
            checklist=updated_checklist,
            calendly_link=calendly_link,
            org_name=org_name,
        )
        meeting_link = calendly_link

        # Fire notifications
        await fire_qualified_lead_notifications(
            checklist=updated_checklist,
            session_id=session_id,
            org_name=org_name,
            integration=integration,
        )

    elif qual_status == "unqualified":
        # Unqualified — serve structured KB resources
        logger.info(f"🔴 Lead UNQUALIFIED: {session_id[:12]}...")

    # Always fetch video/resource links so the widget can embed them
    # (videos should be available regardless of qualification status)
    kb_resources_list = query_kb_resources(org_id, sb, limit=5)
    logger.info(f"📎 KB resources available: {len(kb_resources_list)} for org {org_id}")

    # 9. Generate AI reply with qualification-aware guidance
    token_usage = None
    try:
        llm_result = await generate_reply(
            message=message,
            conversation_history=conversation,
            org_name=org_name,
            groq_api_key=settings.groq_api_key,
            qualification_status=qual_status,
            checklist=updated_checklist,
            missing_fields=missing_fields,
            drafted_email=drafted_email,
            meeting_proposal=meeting_proposal,
            kb_resources=kb_resources_list,
            kb_resource=kb_resource,
            persona=persona,
            conversation_summary=conv_summary,
        )
        reply = llm_result["reply"]
        token_usage = llm_result.get("token_usage")
    except Exception as exc:
        logger.error(f"LLM generate_reply FAILED: {type(exc).__name__}: {exc}")
        reply = (
            f"I apologize, but I'm having trouble generating a response right now. "
            f"Please try again in a moment."
        )

    # Log token usage for the Usage Monitor
    if token_usage:
        try:
            sb.table("usage_logs").insert({
                "org_id": org_id,
                "session_id": session_id,
                "model": token_usage.get("model", "unknown"),
                "prompt_tokens": token_usage.get("prompt_tokens", 0),
                "completion_tokens": token_usage.get("completion_tokens", 0),
                "total_tokens": token_usage.get("total_tokens", 0),
                "endpoint": "chat",
                "created_at": datetime.now(timezone.utc).isoformat(),
            }).execute()
        except Exception as exc:
            logger.warning(f"Usage log insert failed (non-fatal): {exc}")

    # Add AI reply to conversation
    conversation.append({"role": "assistant", "content": reply, "timestamp": datetime.now(timezone.utc).isoformat()})

    # 10. Record qualification history
    try:
        turn_number = len([t for t in conversation if t["role"] == "user"])
        sb.table("intent_history").insert({
            "lead_id": lead["id"],
            "turn_number": turn_number,
            "score_before": 0,
            "score_after": 0,
            "signals": [f"qual_status:{qual_status}"] + [f"{k}:{v}" for k, v in updated_checklist.items() if v],
        }).execute()
    except Exception as exc:
        logger.warning(f"Qualification history insert failed (non-fatal): {exc}")

    # 11. Update lead in Supabase
    # Map qualification status to legacy intent fields for backward compat
    intent_score_map = {"collecting": 30, "unqualified": 10, "qualified": 95}
    intent_state_map = {"collecting": "Exploring", "unqualified": "Exploring", "qualified": "Decision-Ready"}

    update_data = {
        "intent_score": intent_score_map.get(qual_status, 30),
        "intent_state": intent_state_map.get(qual_status, "Exploring"),
        "signals": [f"{k}:{v}" for k, v in updated_checklist.items() if v],
        "resources_served": resources_served,
        "conversation": conversation,
        "persona": persona,
        "crm_filed": crm_filed,
        "qualification_status": qual_status,
        "qualification_checklist": updated_checklist,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    if qual_status == "qualified":
        update_data["calendly_shown"] = True

    sb.table("leads").update(update_data).eq("session_id", session_id).execute()

    # 12. Return response
    show_calendly = qual_status == "qualified" and bool(calendly_link)

    return ChatMessageResponse(
        reply=reply,
        session_id=session_id,
        qualification_status=qual_status,
        qualification_checklist=QualificationChecklist(**{
            k: v for k, v in updated_checklist.items()
            if k in QualificationChecklist.model_fields
        }),
        drafted_email=drafted_email,
        meeting_link=meeting_link if show_calendly else None,
        kb_resources=[
            KBResource(**r) for r in kb_resources_list
        ] if kb_resources_list else [],
        # Legacy fields
        intent_score=intent_score_map.get(qual_status, 30),
        intent_state=intent_state_map.get(qual_status, "Exploring"),
        persona=persona,
        resource=resource_response,
        show_calendly=show_calendly,
        calendly_link=calendly_link if show_calendly else None,
    )
