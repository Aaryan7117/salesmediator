"""
Team routes — admin generates invite codes, lists team members.

POST /team/invite   — generate a new invite code for the org
GET  /team/members  — list all team members for the org
"""

import secrets

import logging

from fastapi import APIRouter, HTTPException, Request, status

logger = logging.getLogger(__name__)

from models.schemas import InviteCodeResponse, TeamMemberResponse
from supabase_client import get_supabase

router = APIRouter()


def _get_user_from_token(token: str) -> dict:
    sb = get_supabase()
    try:
        auth_response = sb.auth.get_user(token)
    except Exception as exc:
        logger.error(f"team: token validation failed: {exc}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token: {str(exc)}")
    user_id = str(auth_response.user.id)
    logger.info(f"team: token valid, user_id={user_id}")
    profile = sb.table("users").select("org_id, role").eq("id", user_id).execute()
    logger.info(f"team: profile lookup result: {profile.data}")
    if not profile.data:
        logger.error(f"team: NO profile found for user_id={user_id}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found.")
    return {"user_id": user_id, **profile.data[0]}


def _extract_token(request: Request) -> str:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Bearer token.")
    return auth_header.split(" ", 1)[1]


@router.post("/invite", response_model=InviteCodeResponse, status_code=status.HTTP_201_CREATED)
async def generate_invite(request: Request):
    """Generate a new invite code. Admin only."""
    token = _extract_token(request)
    user = _get_user_from_token(token)

    if user["role"] != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can generate invite codes.")

    sb = get_supabase()
    org_id = user["org_id"]
    code = secrets.token_urlsafe(8)  # Short, shareable code

    sb.table("invite_codes").insert({
        "org_id": org_id,
        "code": code,
    }).execute()

    return InviteCodeResponse(code=code, org_id=org_id)


@router.get("/members", response_model=list[TeamMemberResponse])
async def list_members(request: Request):
    """List all team members for the org."""
    token = _extract_token(request)
    user = _get_user_from_token(token)

    sb = get_supabase()
    org_id = user["org_id"]

    members_result = (
        sb.table("users")
        .select("id, full_name, role, created_at")
        .eq("org_id", org_id)
        .order("created_at", desc=False)
        .execute()
    )

    members: list[TeamMemberResponse] = []
    for m in members_result.data:
        # Count leads assigned to this member
        leads_count = 0
        if m["role"] == "rep":
            leads_result = (
                sb.table("leads")
                .select("id", count="exact")
                .eq("org_id", org_id)
                .eq("assigned_rep_id", m["id"])
                .execute()
            )
            leads_count = leads_result.count or 0

        members.append(TeamMemberResponse(
            id=m["id"],
            full_name=m.get("full_name"),
            role=m["role"],
            leads_count=leads_count,
            created_at=m.get("created_at"),
        ))

    return members
