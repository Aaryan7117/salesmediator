"""
Chat route — the main AI pipeline for buyer conversations.

POST /chat/{org_slug} — public endpoint, rate-limited, no auth required.

Pipeline per message:
1. Resolve org by slug
2. Create or fetch session (lead)
3. Regex intent scoring
4. LLM intent analysis (if ambiguous)
5. Detect persona (turns 1–3 only)
6. Memory: generate summary if needed
7. Retrieve KB context (multi-result with citations)
8. Generate AI reply with pacing-aware guidance
9. Multi-threshold suppression gate (Calendly)
10. Fire integrations if threshold crossed (Slack, Webhook)
11. Record intent history for timeline charts
12. Update lead in Supabase
13. Return response
"""

import re
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from time import time

from fastapi import APIRouter, HTTPException, Request, status

from config import settings
from models.schemas import ChatMessageRequest, ChatMessageResponse, ResourceServed
from supabase_client import get_supabase
from services.intent import score_intent, get_intent_state
from services.persona import detect_persona
from services.kb_retrieval import query_kb
from services.llm import generate_reply
from services.pacing import (
    get_pacing_instruction,
    should_show_calendly_v2,
    fire_slack_webhook,
    fire_generic_webhook,
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
    Now with: hybrid intent scoring, conversation memory, multi-threshold pacing.
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
        current_score = lead.get("intent_score", 0)
        existing_signals = lead.get("signals") or []
        resources_served = lead.get("resources_served") or []
        persona = lead.get("persona")
        calendly_shown = lead.get("calendly_shown", False)
        crm_filed = lead.get("crm_filed", False)
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
        }
        sb.table("leads").insert(lead).execute()
        conversation = []
        current_score = 0
        existing_signals = []
        resources_served = []
        persona = None
        calendly_shown = False
        crm_filed = False

    # Add buyer message to conversation
    now_str = datetime.now(timezone.utc).isoformat()
    conversation.append({"role": "user", "content": message, "timestamp": now_str})

    # 3. Regex intent scoring
    new_score, triggered_signals = score_intent(message, current_score)

    # 4. LLM intent analysis (if regex found 0-1 signals — ambiguous case)
    llm_analysis = None
    disambiguation_note = ""
    if len(triggered_signals) <= 1:
        try:
            from services.intent_llm import llm_intent_analysis
            llm_analysis = await llm_intent_analysis(
                message=message,
                conversation_context=conversation,
                current_score=current_score,
                groq_api_key=settings.groq_api_key,
            )
            if llm_analysis:
                # Apply LLM-suggested delta (conservative)
                llm_delta = llm_analysis.get("suggested_delta", 0)
                confidence = llm_analysis.get("confidence", 0)
                # Only apply if LLM is reasonably confident
                if confidence >= 0.6:
                    new_score = max(0, min(100, new_score + llm_delta))
                    # Add LLM-detected signal labels
                    for label in llm_analysis.get("signal_labels", []):
                        if label not in triggered_signals:
                            triggered_signals.append(label)

                # Handle contradiction detection
                if llm_analysis.get("contradiction_detected") and llm_analysis.get("disambiguating_question"):
                    disambiguation_note = llm_analysis["disambiguating_question"]
                    logger.info(f"Contradiction detected, disambiguation: {disambiguation_note[:60]}")
        except Exception as exc:
            logger.warning(f"LLM intent analysis failed (continuing with regex): {exc}")

    intent_state = get_intent_state(new_score)

    # Merge signals (deduplicate)
    all_signals = list(dict.fromkeys(existing_signals + triggered_signals))

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

    # 7. Retrieve KB context (multi-result)
    kb_resource = None
    resource_response = None
    chroma_client = request.app.state.chroma_client
    embedding_model = request.app.state.embedding_model

    if chroma_client and embedding_model:
        kb_resource = query_kb(message, org_id, embedding_model, chroma_client)

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

    # 8. Generate AI reply with pacing instruction
    pacing_instruction = get_pacing_instruction(new_score, persona)
    try:
        reply = await generate_reply(
            message=message,
            conversation_history=conversation,
            intent_state=intent_state,
            persona=persona,
            kb_resource=kb_resource,
            org_name=org_name,
            groq_api_key=settings.groq_api_key,
            pacing_instruction=pacing_instruction,
            conversation_summary=conv_summary,
            disambiguation_note=disambiguation_note,
        )
    except Exception as exc:
        logger.error(f"LLM generate_reply FAILED: {type(exc).__name__}: {exc}")
        reply = (
            f"I apologize, but I'm having trouble generating a response right now. "
            f"Please try again in a moment."
        )

    # Add AI reply to conversation
    conversation.append({"role": "assistant", "content": reply, "timestamp": datetime.now(timezone.utc).isoformat()})

    # 9. Multi-threshold suppression gate
    show_calendly = False
    calendly_link = None

    integration_result = sb.table("integrations").select("*").eq("org_id", org_id).execute()
    integration = integration_result.data[0] if integration_result.data else None

    if integration:
        calendly_link = integration.get("calendly_link")
        show_calendly = should_show_calendly_v2(new_score, calendly_shown, calendly_link)

    # 10. Fire integrations if threshold crossed (score just hit 71+)
    if new_score >= 71 and current_score < 71 and integration:
        lead_data = {
            "persona": persona,
            "intent_score": new_score,
            "intent_state": intent_state,
            "signals": all_signals,
            "session_id": session_id,
            "updated_at": now_str,
        }

        # Slack webhook
        slack_webhook = integration.get("slack_webhook")
        if slack_webhook:
            await fire_slack_webhook(lead_data, slack_webhook)

        # Generic webhook
        webhook_url = integration.get("webhook_url")
        if webhook_url:
            await fire_generic_webhook(lead_data, webhook_url)

    # 11. Record intent history for timeline charts
    try:
        turn_number = len([t for t in conversation if t["role"] == "user"])
        sb.table("intent_history").insert({
            "lead_id": lead["id"],
            "turn_number": turn_number,
            "score_before": current_score,
            "score_after": new_score,
            "signals": triggered_signals,
        }).execute()
    except Exception as exc:
        logger.warning(f"Intent history insert failed (non-fatal): {exc}")

    # 12. Update lead in Supabase
    update_data = {
        "intent_score": new_score,
        "intent_state": intent_state,
        "signals": all_signals,
        "resources_served": resources_served,
        "conversation": conversation,
        "persona": persona,
        "crm_filed": crm_filed,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    if show_calendly:
        update_data["calendly_shown"] = True

    sb.table("leads").update(update_data).eq("session_id", session_id).execute()

    # 13. Return response
    return ChatMessageResponse(
        reply=reply,
        session_id=session_id,
        intent_score=new_score,
        intent_state=intent_state,
        persona=persona,
        resource=resource_response,
        show_calendly=show_calendly,
        calendly_link=calendly_link if show_calendly else None,
    )
