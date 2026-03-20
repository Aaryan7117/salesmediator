"""
Third-party integrations — Frappe CRM, GitHub Issues, and Calendly suppression gate.
All external calls are async, non-blocking, and fail silently to the buyer.
"""

import httpx


def should_show_calendly(
    score: int,
    calendly_shown: bool,
    calendly_link: str | None,
) -> bool:
    """
    Suppression gate: only show the Calendly booking CTA when
    the intent score crosses 76 AND it has never been shown before
    AND the org has a Calendly link configured.
    """
    return score >= 76 and not calendly_shown and bool(calendly_link)


async def fire_frappe(lead: dict, frappe_url: str, frappe_token: str) -> None:
    """
    Create a Lead record in Frappe CRM.
    Fails silently — CRM errors must never surface to the buyer.
    """
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                f"{frappe_url}/api/resource/Lead",
                headers={"Authorization": f"token {frappe_token}"},
                json={
                    "lead_name": lead.get("persona", "Inbound Lead"),
                    "custom_intent_score": lead["intent_score"],
                    "custom_persona": lead["persona"],
                    "custom_intent_state": lead["intent_state"],
                    "custom_signals": ", ".join(lead.get("signals", [])),
                    "custom_session_id": str(lead["session_id"]),
                },
            )
    except Exception:
        pass  # Never surface CRM errors to the buyer


async def fire_github(lead: dict, github_repo: str, github_pat: str) -> str | None:
    """
    Create a GitHub Issue for a hot lead.
    Returns the issue URL on success, None on failure.
    Fails silently — never surface errors to the buyer.
    """
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(
                f"https://api.github.com/repos/{github_repo}/issues",
                headers={
                    "Authorization": f"token {github_pat}",
                    "Accept": "application/vnd.github+json",
                },
                json={
                    "title": f"Hot lead: {lead.get('persona', 'Unknown')} — score {lead['intent_score']}",
                    "body": (
                        f"**Persona:** {lead.get('persona', 'Unknown')}\n"
                        f"**Score:** {lead['intent_score']}\n"
                        f"**State:** {lead['intent_state']}\n"
                        f"**Signals:** {', '.join(lead.get('signals', []))}\n"
                        f"**Session:** {lead['session_id']}"
                    ),
                    "labels": ["hot-lead", "sales"],
                },
            )
            return r.json().get("html_url")
    except Exception:
        return None
