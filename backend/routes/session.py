"""
Session routes — rep polling endpoint to get live lead state.

GET /session/{session_id} — returns the current lead state for the rep dashboard.
"""

from fastapi import APIRouter, HTTPException, Request, status

from models.schemas import SessionResponse, LeadResponse, ConversationTurn
from supabase_client import get_supabase

router = APIRouter()


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


def _extract_token(request: Request) -> str:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Bearer token.")
    return auth_header.split(" ", 1)[1]


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(session_id: str, request: Request):
    """Get the current state of a lead by session ID. Rep/admin only."""
    token = _extract_token(request)
    user = _get_user_from_token(token)

    sb = get_supabase()
    result = (
        sb.table("leads")
        .select("*")
        .eq("session_id", session_id)
        .eq("org_id", user["org_id"])
        .execute()
    )

    if not result.data:
        return SessionResponse(lead=None)

    row = result.data[0]
    conversation = [ConversationTurn(**t) for t in (row.get("conversation") or [])]

    return SessionResponse(
        lead=LeadResponse(
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
    )
