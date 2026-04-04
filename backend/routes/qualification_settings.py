"""
Qualification Settings — CRUD for org-configurable qualification criteria.

GET  /qualification-settings/ → Fetch current org criteria (or defaults)
PUT  /qualification-settings/ → Upsert org criteria
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request, status

from models.schemas import (
    QualificationCriteriaResponse,
    QualificationCriteriaUpdateRequest,
)
from supabase_client import get_supabase

router = APIRouter()
logger = logging.getLogger(__name__)

# Default criteria (matches qualification.py defaults)
_DEFAULT_REQUIRED = ["name", "company", "role", "use_case"]
_DEFAULT_CONDITIONS: list[dict] = []


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
        logger.error(f"qualification_settings: token validation failed: {exc}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token: {str(exc)}")
    user_id = str(auth_response.user.id)
    profile = sb.table("users").select("org_id, role").eq("id", user_id).execute()
    if not profile.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found.")
    return {"user_id": user_id, **profile.data[0]}


@router.get("/", response_model=QualificationCriteriaResponse)
async def get_qualification_settings(request: Request):
    """Fetch qualification criteria for the user's org."""
    token = _extract_token(request)
    user = _get_user_from_token(token)
    sb = get_supabase()
    org_id = user["org_id"]

    try:
        result = (
            sb.table("qualification_criteria")
            .select("required_fields, conditions")
            .eq("org_id", org_id)
            .limit(1)
            .execute()
        )

        if result.data:
            row = result.data[0]
            return QualificationCriteriaResponse(
                required_fields=row.get("required_fields") or _DEFAULT_REQUIRED,
                conditions=row.get("conditions") or _DEFAULT_CONDITIONS,
                is_custom=True,
            )
    except Exception as exc:
        logger.warning(f"Failed to fetch qualification criteria: {exc}")

    # Return defaults
    return QualificationCriteriaResponse(
        required_fields=_DEFAULT_REQUIRED,
        conditions=_DEFAULT_CONDITIONS,
        is_custom=False,
    )


@router.put("/", response_model=QualificationCriteriaResponse)
async def update_qualification_settings(body: QualificationCriteriaUpdateRequest, request: Request):
    """Create or update qualification criteria for the user's org. Admin only."""
    token = _extract_token(request)
    user = _get_user_from_token(token)

    if user["role"] != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can update qualification settings.")

    sb = get_supabase()
    org_id = user["org_id"]

    # Validate field names
    allowed_fields = {"name", "company", "role", "use_case", "company_size", "timeline", "timeline_months"}
    for f in body.required_fields:
        if f not in allowed_fields:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid required field: '{f}'. Allowed: {sorted(allowed_fields)}",
            )

    for cond in body.conditions:
        if cond.field not in allowed_fields:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid condition field: '{cond.field}'. Allowed: {sorted(allowed_fields)}",
            )

    criteria_data = {
        "org_id": org_id,
        "required_fields": body.required_fields,
        "conditions": [c.model_dump() for c in body.conditions],
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        sb.table("qualification_criteria").upsert(criteria_data).execute()
        logger.info(f"Qualification criteria updated for org {org_id}")
    except Exception as exc:
        logger.error(f"Failed to upsert qualification criteria: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save qualification criteria",
        )

    return QualificationCriteriaResponse(
        required_fields=body.required_fields,
        conditions=[c.model_dump() for c in body.conditions],
        is_custom=True,
    )
