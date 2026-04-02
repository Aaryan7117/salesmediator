"""
Multi-threshold Pacing Engine.

Replaces the binary 76-gate with graduated agent behavior.
Different score ranges trigger different actions, creating
an adaptive sales experience that doesn't feel robotic.
"""

import logging
import httpx

logger = logging.getLogger(__name__)


# ── Score Thresholds ──
THRESHOLDS = {
    "educational":   (0, 25),    # Ask questions, provide general info
    "comparative":   (26, 50),   # Offer comparisons, case studies
    "proactive":     (51, 70),   # Surface pricing proactively, mention team availability
    "conversion":    (71, 85),   # Show Calendly, reference "teams like yours"
    "handoff":       (86, 100),  # Push for human handoff, urgent notification
}


def get_pacing_stage(score: int) -> str:
    """Get the current pacing stage based on intent score."""
    for stage, (low, high) in THRESHOLDS.items():
        if low <= score <= high:
            return stage
    return "educational"


def get_pacing_instruction(score: int, persona: str | None = None) -> str:
    """
    Get LLM guidance based on the current pacing stage.
    This replaces the static STATE_INSTRUCTIONS in llm.py with
    more nuanced, score-aware behavior.
    """
    stage = get_pacing_stage(score)
    persona_str = f" (Buyer persona: {persona})" if persona else ""

    instructions = {
        "educational": (
            f"Score: {score}/100.{persona_str} "
            "The buyer is early-stage. Be helpful and educational. "
            "Answer their question concisely. End with ONE clarifying question "
            "to learn about their goals, team size, or timeline. "
            "Do NOT mention pricing, demos, or scheduling."
        ),
        "comparative": (
            f"Score: {score}/100.{persona_str} "
            "The buyer is showing moderate interest. Provide detailed, "
            "specific answers. If relevant, naturally mention case studies "
            "or comparison points from the knowledge base. "
            "Ask about their evaluation criteria."
        ),
        "proactive": (
            f"Score: {score}/100.{persona_str} "
            "The buyer is engaged. Be proactive — surface pricing "
            "or relevant plan details if they haven't asked yet. "
            "Mention that your team is available to answer deeper questions. "
            "Be warm but direct."
        ),
        "conversion": (
            f"Score: {score}/100.{persona_str} "
            "The buyer is near-decision. A scheduling option will be shown "
            "separately. Reference how 'teams like theirs' have succeeded. "
            "Answer final questions with confidence. Don't be pushy — "
            "they're almost there."
        ),
        "handoff": (
            f"Score: {score}/100.{persona_str} "
            "The buyer is ready. Be direct and warm. Confirm their needs "
            "and express eagerness to get them set up. The scheduling link "
            "is shown. Focus on removing any last friction."
        ),
    }

    return instructions.get(stage, instructions["educational"])


def should_show_calendly_v2(
    score: int,
    calendly_shown: bool,
    calendly_link: str | None,
) -> bool:
    """
    Multi-threshold Calendly gate.
    Shows Calendly only when score >= 71 (conversion stage).
    Once shown, stays shown.
    """
    if calendly_shown:
        return True  # Once shown, keep showing
    return score >= 71 and bool(calendly_link)


async def fire_slack_webhook(lead: dict, webhook_url: str) -> None:
    """
    Send a Slack notification for a hot lead.
    Fires at score >= 71 (conversion threshold).
    """
    try:
        payload = {
            "text": (
                f"🔥 *Hot Lead Detected!*\n"
                f"*Score:* {lead.get('intent_score', 0)}/100\n"
                f"*Persona:* {lead.get('persona', 'Unknown')}\n"
                f"*State:* {lead.get('intent_state', 'Unknown')}\n"
                f"*Signals:* {', '.join(lead.get('signals', []))}\n"
                f"*Session:* `{lead.get('session_id', 'N/A')[:12]}...`"
            ),
        }
        async with httpx.AsyncClient(timeout=5) as client:
            await client.post(webhook_url, json=payload)
        logger.info("Slack notification sent for hot lead")
    except Exception as exc:
        logger.warning(f"Slack webhook failed (non-fatal): {exc}")


async def fire_generic_webhook(lead: dict, webhook_url: str) -> None:
    """
    Fire a generic POST webhook when a lead crosses the conversion threshold.
    Companies connect this to Zapier/Make/custom CRM.
    """
    try:
        payload = {
            "event": "lead_decision_ready",
            "lead": {
                "session_id": lead.get("session_id"),
                "persona": lead.get("persona"),
                "intent_score": lead.get("intent_score"),
                "intent_state": lead.get("intent_state"),
                "signals": lead.get("signals", []),
            },
            "timestamp": lead.get("updated_at"),
        }
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(webhook_url, json=payload)
        logger.info(f"Generic webhook fired to {webhook_url[:40]}...")
    except Exception as exc:
        logger.warning(f"Generic webhook failed (non-fatal): {exc}")
