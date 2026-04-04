"""
KB Resources — CRUD for video links, spec sheets, guides.

GET    /kb-resources/       → List all resources for org
POST   /kb-resources/       → Add a new resource (video link, doc link, etc.)
DELETE /kb-resources/{id}   → Remove a resource
"""

import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel

from supabase_client import get_supabase

router = APIRouter()
logger = logging.getLogger(__name__)


# ── Schemas ──
class KBResourceCreate(BaseModel):
    title: str
    url: str
    type: str = "video"  # "video" | "spec" | "doc" | "guide"
    description: str = ""


class KBResourceResponse(BaseModel):
    id: str
    title: str
    url: str
    type: str
    description: str
    created_at: str | None = None


# ── Auth helper (same pattern as other routes) ──
def _extract_token(request: Request) -> str:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Bearer token.")
    return auth_header.split(" ", 1)[1]


def _get_user_org(token: str) -> str:
    sb = get_supabase()
    try:
        auth_response = sb.auth.get_user(token)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token: {str(exc)}")
    user_id = str(auth_response.user.id)
    profile = sb.table("users").select("org_id").eq("id", user_id).execute()
    if not profile.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found.")
    return profile.data[0]["org_id"]


# ── Routes ──
@router.get("/", response_model=list[KBResourceResponse])
async def list_kb_resources(request: Request):
    """List all KB resources for the user's org."""
    token = _extract_token(request)
    org_id = _get_user_org(token)
    sb = get_supabase()

    try:
        result = (
            sb.table("kb_resources")
            .select("id, title, url, type, description, created_at")
            .eq("org_id", org_id)
            .order("created_at", desc=True)
            .execute()
        )
        return result.data or []
    except Exception as exc:
        logger.error(f"Failed to list KB resources: {exc}")
        return []


@router.post("/", response_model=KBResourceResponse, status_code=status.HTTP_201_CREATED)
async def create_kb_resource(body: KBResourceCreate, request: Request):
    """Add a new video/doc/guide resource link."""
    token = _extract_token(request)
    org_id = _get_user_org(token)
    sb = get_supabase()

    # Validate type
    allowed_types = {"video", "spec", "doc", "guide"}
    if body.type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid type: '{body.type}'. Allowed: {sorted(allowed_types)}",
        )

    resource_data = {
        "id": str(uuid.uuid4()),
        "org_id": org_id,
        "title": body.title.strip(),
        "url": body.url.strip(),
        "type": body.type,
        "description": body.description.strip(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        result = sb.table("kb_resources").insert(resource_data).execute()
        logger.info(f"KB resource created: {resource_data['title']} ({body.type})")
        return result.data[0]
    except Exception as exc:
        logger.error(f"Failed to create KB resource: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save resource",
        )


@router.delete("/{resource_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_kb_resource(resource_id: str, request: Request):
    """Delete a KB resource."""
    token = _extract_token(request)
    org_id = _get_user_org(token)
    sb = get_supabase()

    try:
        # Verify ownership
        existing = (
            sb.table("kb_resources")
            .select("id")
            .eq("id", resource_id)
            .eq("org_id", org_id)
            .execute()
        )
        if not existing.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found.")

        sb.table("kb_resources").delete().eq("id", resource_id).execute()
        logger.info(f"KB resource deleted: {resource_id}")
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Failed to delete KB resource: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete resource",
        )
