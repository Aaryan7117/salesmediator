"""
Leads routes — admin sees all leads, reps see only their assigned leads.

GET  /leads/          — all leads for the org (admin) or assigned leads (rep)
GET  /leads/mine      — rep's assigned leads only
GET  /leads/{lead_id} — full lead detail with conversation transcript
"""

import logging

from fastapi import APIRouter, HTTPException, Request, status

logger = logging.getLogger(__name__)

from models.schemas import LeadListItem, LeadResponse, ConversationTurn
from supabase_client import get_supabase

router = APIRouter()


def _get_user_from_token(token: str) -> dict:
    sb = get_supabase()
    try:
        auth_response = sb.auth.get_user(token)
    except Exception as exc:
        logger.error(f"leads: token validation failed: {exc}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token: {str(exc)}")
    user_id = str(auth_response.user.id)
    logger.info(f"leads: token valid, user_id={user_id}")
    profile = sb.table("users").select("org_id, role").eq("id", user_id).execute()
    logger.info(f"leads: profile lookup result: {profile.data}")
    if not profile.data:
        logger.error(f"leads: NO profile found for user_id={user_id}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found.")
    return {"user_id": user_id, **profile.data[0]}


def _extract_token(request: Request) -> str:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Bearer token.")
    return auth_header.split(" ", 1)[1]


def _row_to_list_item(row: dict) -> LeadListItem:
    return LeadListItem(
        id=row["id"],
        session_id=row["session_id"],
        persona=row.get("persona"),
        intent_score=row.get("intent_score", 0),
        intent_state=row.get("intent_state", "Exploring"),
        signals=row.get("signals") or [],
        updated_at=row.get("updated_at"),
    )


def _row_to_detail(row: dict) -> LeadResponse:
    conversation = [ConversationTurn(**t) for t in (row.get("conversation") or [])]
    return LeadResponse(
        id=row["id"],
        session_id=row["session_id"],
        persona=row.get("persona"),
        intent_score=row.get("intent_score", 0),
        intent_state=row.get("intent_state", "Exploring"),
        signals=row.get("signals") or [],
        resources_served=row.get("resources_served") or [],
        conversation=conversation,
        assigned_rep_id=row.get("assigned_rep_id"),
        crm_filed=row.get("crm_filed", False),
        github_issue_url=row.get("github_issue_url"),
        calendly_shown=row.get("calendly_shown", False),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
    )


@router.get("/", response_model=list[LeadListItem])
async def list_leads(request: Request):
    """
    Admin: all leads for the org, sorted by intent_score descending.
    Rep: only their assigned leads.
    """
    token = _extract_token(request)
    user = _get_user_from_token(token)
    sb = get_supabase()

    query = (
        sb.table("leads")
        .select("id, session_id, persona, intent_score, intent_state, signals, updated_at")
        .eq("org_id", user["org_id"])
        .order("intent_score", desc=True)
    )

    if user["role"] == "rep":
        query = query.eq("assigned_rep_id", user["user_id"])

    result = query.execute()
    return [_row_to_list_item(row) for row in result.data]


@router.get("/mine", response_model=list[LeadListItem])
async def my_leads(request: Request):
    """Rep's assigned leads only."""
    token = _extract_token(request)
    user = _get_user_from_token(token)
    sb = get_supabase()

    result = (
        sb.table("leads")
        .select("id, session_id, persona, intent_score, intent_state, signals, updated_at")
        .eq("org_id", user["org_id"])
        .eq("assigned_rep_id", user["user_id"])
        .order("intent_score", desc=True)
        .execute()
    )

    return [_row_to_list_item(row) for row in result.data]


@router.get("/{lead_id}", response_model=LeadResponse)
async def get_lead_detail(lead_id: str, request: Request):
    """Full lead detail with conversation transcript."""
    token = _extract_token(request)
    user = _get_user_from_token(token)
    sb = get_supabase()

    result = (
        sb.table("leads")
        .select("*")
        .eq("id", lead_id)
        .eq("org_id", user["org_id"])
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found.")

    return _row_to_detail(result.data[0])
