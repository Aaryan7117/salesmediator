"""
Usage monitoring route — token tracking, rate stats, cost estimation.

GET /usage/stats/{org_id}  — aggregate usage statistics
GET /usage/logs/{org_id}   — recent usage log entries
"""

import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, status

from config import settings
from supabase_client import get_supabase

router = APIRouter()
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Groq pricing (per 1M tokens) — updated for common models
# ---------------------------------------------------------------------------
MODEL_PRICING = {
    "llama-3.3-70b-versatile": {"input": 0.59, "output": 0.79},
    "llama-3.1-70b-versatile": {"input": 0.59, "output": 0.79},
    "llama-3.1-8b-instant": {"input": 0.05, "output": 0.08},
    "llama3-70b-8192": {"input": 0.59, "output": 0.79},
    "llama3-8b-8192": {"input": 0.05, "output": 0.08},
    "mixtral-8x7b-32768": {"input": 0.24, "output": 0.24},
    "gemma2-9b-it": {"input": 0.20, "output": 0.20},
}

# Rate limits per model (Groq free tier — requests per minute)
MODEL_RATE_LIMITS = {
    "llama-3.3-70b-versatile": {"rpm": 30, "tpm": 6000, "rpd": 1000},
    "llama-3.1-70b-versatile": {"rpm": 30, "tpm": 6000, "rpd": 1000},
    "llama-3.1-8b-instant": {"rpm": 30, "tpm": 20000, "rpd": 1000},
    "llama3-70b-8192": {"rpm": 30, "tpm": 6000, "rpd": 1000},
    "llama3-8b-8192": {"rpm": 30, "tpm": 20000, "rpd": 1000},
    "mixtral-8x7b-32768": {"rpm": 30, "tpm": 5000, "rpd": 1000},
    "gemma2-9b-it": {"rpm": 30, "tpm": 15000, "rpd": 1000},
}


def _calculate_cost(model: str, prompt_tokens: int, completion_tokens: int) -> float:
    """Calculate cost in USD based on model pricing."""
    pricing = MODEL_PRICING.get(model, {"input": 0.59, "output": 0.79})
    input_cost = (prompt_tokens / 1_000_000) * pricing["input"]
    output_cost = (completion_tokens / 1_000_000) * pricing["output"]
    return round(input_cost + output_cost, 6)


@router.get("/stats/{org_id}")
async def get_usage_stats(org_id: str):
    """Aggregate usage stats for the Usage Monitor dashboard."""
    sb = get_supabase()

    try:
        # Fetch all usage logs for this org
        result = sb.table("usage_logs").select("*").eq("org_id", org_id).order(
            "created_at", desc=True
        ).limit(5000).execute()
        logs = result.data or []
    except Exception as exc:
        logger.warning(f"Usage logs fetch failed: {exc}")
        logs = []

    if not logs:
        model = settings.groq_model
        rate_limits = MODEL_RATE_LIMITS.get(model, {})
        return {
            "total_requests": 0,
            "total_prompt_tokens": 0,
            "total_completion_tokens": 0,
            "total_tokens": 0,
            "total_cost_usd": 0.0,
            "avg_tokens_per_request": 0,
            "avg_cost_per_request": 0.0,
            "model": model,
            "model_pricing": MODEL_PRICING.get(model, {}),
            "rate_limits": rate_limits,
            "today": {
                "requests": 0,
                "tokens": 0,
                "cost_usd": 0.0,
            },
            "last_7_days": {
                "requests": 0,
                "tokens": 0,
                "cost_usd": 0.0,
            },
            "daily_breakdown": [],
            "hourly_breakdown": [],
        }

    # Calculate aggregates
    total_prompt = sum(l.get("prompt_tokens", 0) for l in logs)
    total_completion = sum(l.get("completion_tokens", 0) for l in logs)
    total_tokens = sum(l.get("total_tokens", 0) for l in logs)
    total_cost = sum(
        _calculate_cost(
            l.get("model", settings.groq_model),
            l.get("prompt_tokens", 0),
            l.get("completion_tokens", 0),
        )
        for l in logs
    )
    total_requests = len(logs)

    # Today's stats
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_logs = [l for l in logs if l.get("created_at", "") >= today_start.isoformat()]
    today_tokens = sum(l.get("total_tokens", 0) for l in today_logs)
    today_cost = sum(
        _calculate_cost(l.get("model", ""), l.get("prompt_tokens", 0), l.get("completion_tokens", 0))
        for l in today_logs
    )

    # Last 7 days
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    week_logs = [l for l in logs if l.get("created_at", "") >= week_ago]
    week_tokens = sum(l.get("total_tokens", 0) for l in week_logs)
    week_cost = sum(
        _calculate_cost(l.get("model", ""), l.get("prompt_tokens", 0), l.get("completion_tokens", 0))
        for l in week_logs
    )

    # Daily breakdown (last 7 days)
    daily_breakdown = []
    for i in range(7):
        day = (datetime.now(timezone.utc) - timedelta(days=6 - i)).strftime("%Y-%m-%d")
        day_logs = [l for l in logs if l.get("created_at", "").startswith(day)]
        daily_breakdown.append({
            "date": day,
            "requests": len(day_logs),
            "tokens": sum(l.get("total_tokens", 0) for l in day_logs),
            "cost_usd": round(sum(
                _calculate_cost(l.get("model", ""), l.get("prompt_tokens", 0), l.get("completion_tokens", 0))
                for l in day_logs
            ), 6),
        })

    # Hourly breakdown (last 24 hours)
    hourly_breakdown = []
    now = datetime.now(timezone.utc)
    for i in range(24):
        hour_start = (now - timedelta(hours=23 - i)).replace(minute=0, second=0, microsecond=0)
        hour_end = hour_start + timedelta(hours=1)
        hour_logs = [
            l for l in logs
            if hour_start.isoformat() <= l.get("created_at", "") < hour_end.isoformat()
        ]
        hourly_breakdown.append({
            "hour": hour_start.strftime("%H:%M"),
            "requests": len(hour_logs),
            "tokens": sum(l.get("total_tokens", 0) for l in hour_logs),
        })

    model = logs[0].get("model", settings.groq_model) if logs else settings.groq_model
    rate_limits = MODEL_RATE_LIMITS.get(model, {})

    return {
        "total_requests": total_requests,
        "total_prompt_tokens": total_prompt,
        "total_completion_tokens": total_completion,
        "total_tokens": total_tokens,
        "total_cost_usd": round(total_cost, 6),
        "avg_tokens_per_request": round(total_tokens / total_requests) if total_requests else 0,
        "avg_cost_per_request": round(total_cost / total_requests, 6) if total_requests else 0.0,
        "model": model,
        "model_pricing": MODEL_PRICING.get(model, {}),
        "rate_limits": rate_limits,
        "today": {
            "requests": len(today_logs),
            "tokens": today_tokens,
            "cost_usd": round(today_cost, 6),
        },
        "last_7_days": {
            "requests": len(week_logs),
            "tokens": week_tokens,
            "cost_usd": round(week_cost, 6),
        },
        "daily_breakdown": daily_breakdown,
        "hourly_breakdown": hourly_breakdown,
    }


@router.get("/logs/{org_id}")
async def get_usage_logs(org_id: str):
    """Return recent usage log entries for the org."""
    sb = get_supabase()

    try:
        result = sb.table("usage_logs").select("*").eq("org_id", org_id).order(
            "created_at", desc=True
        ).limit(100).execute()
        logs = result.data or []
    except Exception as exc:
        logger.warning(f"Usage logs fetch failed: {exc}")
        logs = []

    # Enrich with cost
    for log in logs:
        log["cost_usd"] = _calculate_cost(
            log.get("model", ""),
            log.get("prompt_tokens", 0),
            log.get("completion_tokens", 0),
        )

    return {"logs": logs}
