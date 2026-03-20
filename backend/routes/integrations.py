"""
Integrations routes — admin configures Frappe CRM, GitHub, Calendly.

GET /integrations/  — get current config (tokens are masked)
PUT /integrations/  — update config
"""

import logging

from fastapi import APIRouter, HTTPException, Request, status

logger = logging.getLogger(__name__)

from models.schemas import IntegrationsResponse, IntegrationsUpdateRequest
from supabase_client import get_supabase

router = APIRouter()


def _get_user_from_token(token: str) -> dict:
    sb = get_supabase()
    try:
        auth_response = sb.auth.get_user(token)
    except Exception as exc:
        logger.error(f"integrations: token validation failed: {exc}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token: {str(exc)}")
    user_id = str(auth_response.user.id)
    logger.info(f"integrations: token valid, user_id={user_id}")
    profile = sb.table("users").select("org_id, role").eq("id", user_id).execute()
    logger.info(f"integrations: profile lookup result: {profile.data}")
    if not profile.data:
        logger.error(f"integrations: NO profile found for user_id={user_id}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found.")
    return {"user_id": user_id, **profile.data[0]}


def _extract_token(request: Request) -> str:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Bearer token.")
    return auth_header.split(" ", 1)[1]


@router.get("/", response_model=IntegrationsResponse)
async def get_integrations(request: Request):
    """Get the org's integration config. Tokens are masked — never return raw values."""
    token = _extract_token(request)
    user = _get_user_from_token(token)

    if user["role"] != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can view integrations.")

    sb = get_supabase()
    result = sb.table("integrations").select("*").eq("org_id", user["org_id"]).execute()

    if not result.data:
        return IntegrationsResponse()

    row = result.data[0]
    return IntegrationsResponse(
        frappe_url=row.get("frappe_url"),
        frappe_token_set=bool(row.get("frappe_token")),
        github_repo=row.get("github_repo"),
        github_pat_set=bool(row.get("github_pat")),
        calendly_link=row.get("calendly_link"),
    )


@router.put("/", response_model=IntegrationsResponse)
async def update_integrations(body: IntegrationsUpdateRequest, request: Request):
    """Update the org's integration config. Admin only."""
    token = _extract_token(request)
    user = _get_user_from_token(token)

    if user["role"] != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can update integrations.")

    sb = get_supabase()
    org_id = user["org_id"]

    # Build update dict — only include fields that were explicitly provided
    update_data: dict = {}
    if body.frappe_url is not None:
        update_data["frappe_url"] = body.frappe_url
    if body.frappe_token is not None:
        update_data["frappe_token"] = body.frappe_token
    if body.github_repo is not None:
        update_data["github_repo"] = body.github_repo
    if body.github_pat is not None:
        update_data["github_pat"] = body.github_pat
    if body.calendly_link is not None:
        update_data["calendly_link"] = body.calendly_link

    # Check if row exists
    existing = sb.table("integrations").select("id").eq("org_id", org_id).execute()

    if existing.data:
        sb.table("integrations").update(update_data).eq("org_id", org_id).execute()
    else:
        update_data["org_id"] = org_id
        sb.table("integrations").insert(update_data).execute()

    # Return the updated config (masked)
    result = sb.table("integrations").select("*").eq("org_id", org_id).execute()
    row = result.data[0]

    return IntegrationsResponse(
        frappe_url=row.get("frappe_url"),
        frappe_token_set=bool(row.get("frappe_token")),
        github_repo=row.get("github_repo"),
        github_pat_set=bool(row.get("github_pat")),
        calendly_link=row.get("calendly_link"),
    )
