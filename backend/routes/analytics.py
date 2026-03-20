"""
Analytics routes — aggregate metrics for the admin overview dashboard.

GET /analytics/ — returns total leads, avg intent score, decision-ready count,
                  and conversion rate for the org.
"""

import logging

from fastapi import APIRouter, HTTPException, Request, status

from models.schemas import AnalyticsResponse
from supabase_client import get_supabase

router = APIRouter()


def _get_user_from_token(token: str) -> dict:
    sb = get_supabase()
    try:
        auth_response = sb.auth.get_user(token)
    except Exception as exc:
        logger = logging.getLogger(__name__)
        logger.error(f"Auth token validation failed: {exc}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token: {str(exc)}")
    user_id = str(auth_response.user.id)
    logger = logging.getLogger(__name__)
    logger.info(f"Token validated. user_id={user_id}")
    profile = sb.table("users").select("org_id, role").eq("id", user_id).execute()
    logger.info(f"Profile lookup result: {profile.data}")
    if not profile.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found.")
    return {"user_id": user_id, **profile.data[0]}


def _extract_token(request: Request) -> str:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Bearer token.")
    return auth_header.split(" ", 1)[1]


@router.get("/", response_model=AnalyticsResponse)
async def get_analytics(request: Request):
    """
    Aggregate analytics for the admin overview dashboard.
    Computes metrics by scanning the leads table for this org.
    """
    token = _extract_token(request)
    user = _get_user_from_token(token)

    sb = get_supabase()
    org_id = user["org_id"]

    # Fetch all leads for this org
    result = (
        sb.table("leads")
        .select("intent_score, intent_state, calendly_shown")
        .eq("org_id", org_id)
        .execute()
    )

    leads = result.data
    total_leads = len(leads)

    if total_leads == 0:
        return AnalyticsResponse(
            total_leads=0,
            avg_intent_score=0.0,
            decision_ready_count=0,
            conversion_rate=0.0,
        )

    total_score = sum(lead.get("intent_score", 0) for lead in leads)
    avg_score = round(total_score / total_leads, 1)
    decision_ready_count = sum(1 for lead in leads if lead.get("intent_state") == "Decision-Ready")
    calendly_shown_count = sum(1 for lead in leads if lead.get("calendly_shown", False))
    conversion_rate = round((calendly_shown_count / total_leads) * 100, 1)

    return AnalyticsResponse(
        total_leads=total_leads,
        avg_intent_score=avg_score,
        decision_ready_count=decision_ready_count,
        conversion_rate=conversion_rate,
    )
