"""
Widget config routes — public endpoint for widget to fetch its config,
authenticated endpoint for admin to update it.

GET  /widget-config/{org_slug}  — public, widget fetches brand color/greeting/bot name
PUT  /widget-config/            — admin updates widget config
"""

import logging
from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel

logger = logging.getLogger(__name__)

from supabase_client import get_supabase

router = APIRouter()


class WidgetConfigResponse(BaseModel):
    bot_name: str = "AI Assistant"
    greeting: str = "Hi! How can I help you today?"
    brand_color: str = "#6366f1"
    position: str = "right"
    avatar_url: str | None = None


class WidgetConfigUpdateRequest(BaseModel):
    bot_name: str | None = None
    greeting: str | None = None
    brand_color: str | None = None
    position: str | None = None
    avatar_url: str | None = None


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


@router.get("/{org_slug}", response_model=WidgetConfigResponse)
async def get_widget_config(org_slug: str):
    """
    Public endpoint — widget.js calls this to get brand colors, bot name, greeting.
    No auth required.
    """
    sb = get_supabase()

    # Resolve org
    org_result = sb.table("orgs").select("id").eq("slug", org_slug).execute()
    if not org_result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organisation not found.")

    org_id = org_result.data[0]["id"]

    # Fetch config
    config_result = sb.table("widget_config").select("*").eq("org_id", org_id).execute()
    if not config_result.data:
        return WidgetConfigResponse()  # defaults

    row = config_result.data[0]
    return WidgetConfigResponse(
        bot_name=row.get("bot_name", "AI Assistant"),
        greeting=row.get("greeting", "Hi! How can I help you today?"),
        brand_color=row.get("brand_color", "#6366f1"),
        position=row.get("position", "right"),
        avatar_url=row.get("avatar_url"),
    )


@router.put("/", response_model=WidgetConfigResponse)
async def update_widget_config(body: WidgetConfigUpdateRequest, request: Request):
    """Admin updates widget appearance config."""
    token = _extract_token(request)
    user = _get_user_from_token(token)

    if user["role"] != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can update widget config.")

    sb = get_supabase()
    org_id = user["org_id"]

    update_data = {}
    if body.bot_name is not None:
        update_data["bot_name"] = body.bot_name
    if body.greeting is not None:
        update_data["greeting"] = body.greeting
    if body.brand_color is not None:
        update_data["brand_color"] = body.brand_color
    if body.position is not None:
        update_data["position"] = body.position
    if body.avatar_url is not None:
        update_data["avatar_url"] = body.avatar_url

    existing = sb.table("widget_config").select("id").eq("org_id", org_id).execute()
    if existing.data:
        sb.table("widget_config").update(update_data).eq("org_id", org_id).execute()
    else:
        update_data["org_id"] = org_id
        sb.table("widget_config").insert(update_data).execute()

    config_result = sb.table("widget_config").select("*").eq("org_id", org_id).execute()
    row = config_result.data[0]

    return WidgetConfigResponse(
        bot_name=row.get("bot_name", "AI Assistant"),
        greeting=row.get("greeting", "Hi! How can I help you today?"),
        brand_color=row.get("brand_color", "#6366f1"),
        position=row.get("position", "right"),
        avatar_url=row.get("avatar_url"),
    )
