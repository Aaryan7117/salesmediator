"""
Live streaming routes — Server-Sent Events (SSE) for real-time monitoring.

GET /live/stream  — SSE stream of recent lead activity (admin connects from Live Monitor)
POST /live/takeover/{lead_id} — Human takeover: admin sends a message as the bot
"""

import asyncio
import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from supabase_client import get_supabase

logger = logging.getLogger(__name__)

router = APIRouter()


def _extract_token(request: Request) -> str:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Bearer token.")
    return auth_header.split(" ", 1)[1]


def _get_user_from_token(token: str) -> dict:
    sb = get_supabase()
    try:
        auth_response = sb.auth.get_user(token)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token: {str(exc)}")
    user_id = str(auth_response.user.id)
    profile = sb.table("users").select("org_id, role").eq("id", user_id).execute()
    if not profile.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found.")
    return {"user_id": user_id, **profile.data[0]}


@router.get("/stream")
async def live_stream(request: Request):
    """
    SSE endpoint — streams lead updates every 3 seconds.
    The web dashboard's Live Monitor connects here.
    Each event contains the latest state of active leads.
    """
    token = _extract_token(request)
    user = _get_user_from_token(token)
    org_id = user["org_id"]

    async def event_generator():
        last_data_hash = ""
        while True:
            # Check if client disconnected
            if await request.is_disconnected():
                break

            try:
                sb = get_supabase()
                # Fetch most recently active leads
                result = (
                    sb.table("leads")
                    .select("id, session_id, persona, intent_score, intent_state, signals, calendly_shown, updated_at")
                    .eq("org_id", org_id)
                    .order("updated_at", desc=True)
                    .limit(15)
                    .execute()
                )

                data = json.dumps(result.data or [])
                data_hash = str(hash(data))

                # Only send if data changed
                if data_hash != last_data_hash:
                    last_data_hash = data_hash
                    yield f"event: leads_update\ndata: {data}\n\n"
                else:
                    # Send heartbeat to keep connection alive
                    yield f"event: heartbeat\ndata: {{}}\n\n"

            except Exception as exc:
                logger.warning(f"SSE stream error: {exc}")
                yield f"event: error\ndata: {{\"error\": \"stream_error\"}}\n\n"

            await asyncio.sleep(3)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


class TakeoverRequest(BaseModel):
    message: str


@router.post("/takeover/{lead_id}")
async def human_takeover(lead_id: str, body: TakeoverRequest, request: Request):
    """
    Human takeover — admin sends a message that appears as the bot's reply.
    The buyer doesn't know it switched to a human.
    Used from the Live Monitor's "Take Over" button.
    """
    token = _extract_token(request)
    user = _get_user_from_token(token)

    if user["role"] != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can take over conversations.")

    sb = get_supabase()

    # Verify lead belongs to this org
    lead_result = (
        sb.table("leads")
        .select("*")
        .eq("id", lead_id)
        .eq("org_id", user["org_id"])
        .execute()
    )

    if not lead_result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found.")

    lead = lead_result.data[0]
    conversation = lead.get("conversation") or []

    # Add the human message as an assistant message (buyer sees it as the bot)
    now_str = datetime.now(timezone.utc).isoformat()
    conversation.append({
        "role": "assistant",
        "content": body.message,
        "timestamp": now_str,
        "human_takeover": True,  # Flag for admin dashboard to show differently
    })

    # Update lead
    sb.table("leads").update({
        "conversation": conversation,
        "updated_at": now_str,
    }).eq("id", lead_id).execute()

    logger.info(f"Human takeover: admin {user['user_id']} sent message to lead {lead_id}")

    return {"status": "sent", "message": body.message}
