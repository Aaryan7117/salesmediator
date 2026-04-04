"""
Tool Orchestration — Triggered actions when qualification criteria are met.

- draft_confirmation_email: LLM generates a personalized email body
- generate_meeting_proposal: Formats Calendly link with context
- fire_qualified_notifications: Slack + webhook alerts
"""

import logging
import httpx
from groq import AsyncGroq

logger = logging.getLogger(__name__)


EMAIL_DRAFT_PROMPT = """You are drafting a professional confirmation email for a qualified sales lead.

Lead Information:
- Name: {name}
- Company: {company}
- Role: {role}
- Use Case: {use_case}
- Company Size: {company_size}
- Timeline: {timeline}

Organization: {org_name}

Write a brief, warm confirmation email (3-5 paragraphs) that:
1. Thanks them for their interest
2. Confirms we understand their use case
3. Mentions the meeting scheduling link will be shared separately
4. Signs off professionally

Keep it concise, professional, and personalized to their specific use case.
Do NOT include subject line — just the email body.
"""


async def draft_confirmation_email(
    checklist: dict,
    org_name: str,
    groq_api_key: str,
) -> str:
    """
    Use LLM to generate a personalized confirmation email for a qualified lead.
    Returns the email body text.
    """
    prompt = EMAIL_DRAFT_PROMPT.format(
        name=checklist.get("name", "there"),
        company=checklist.get("company", "your organization"),
        role=checklist.get("role", "your team"),
        use_case=checklist.get("use_case", "your needs"),
        company_size=checklist.get("company_size", "your team"),
        timeline=checklist.get("timeline", "your timeline"),
        org_name=org_name,
    )

    client = AsyncGroq(api_key=groq_api_key)
    try:
        response = await client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are a professional business email writer. Write concise, warm emails."},
                {"role": "user", "content": prompt},
            ],
            max_tokens=400,
            temperature=0.4,
        )
        email_body = response.choices[0].message.content.strip()
        logger.info(f"Confirmation email drafted for {checklist.get('name', 'lead')}")
        return email_body
    except Exception as exc:
        logger.error(f"Email drafting failed: {exc}")
        return (
            f"Hi {checklist.get('name', 'there')},\n\n"
            f"Thank you for your interest in {org_name}! We've received your details "
            f"and a team member will reach out shortly to discuss how we can help "
            f"{checklist.get('company', 'your organization')} with {checklist.get('use_case', 'your needs')}.\n\n"
            f"Best regards,\nThe {org_name} Team"
        )


async def send_email_via_emailjs(
    checklist: dict,
    email_body: str,
    org_name: str,
    admin_email: str | None = None,
) -> bool:
    """
    Send the drafted confirmation email via EmailJS REST API.
    Sends to the org admin email as a notification of qualified lead.
    Returns True if sent successfully.
    """
    EMAILJS_SERVICE_ID = "service_8amqupr"
    EMAILJS_TEMPLATE_ID = "template_ibfb8l9"
    EMAILJS_PUBLIC_KEY = "VEcCEOkf_84PhAjkD"

    try:
        payload = {
            "service_id": EMAILJS_SERVICE_ID,
            "template_id": EMAILJS_TEMPLATE_ID,
            "user_id": EMAILJS_PUBLIC_KEY,
            "template_params": {
                "to_name": checklist.get("name", "Valued Lead"),
                "company": checklist.get("company", ""),
                "message": email_body,
                "email": admin_email or "hw71111111@gmail.com",
            },
        }
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                "https://api.emailjs.com/api/v1.6/email/send",
                json=payload,
                headers={"Content-Type": "application/json"},
            )
            if resp.status_code == 200:
                logger.info(f"📧 EmailJS sent successfully for {checklist.get('name', 'lead')}")
                return True
            else:
                logger.warning(f"EmailJS returned {resp.status_code}: {resp.text}")
                return False
    except Exception as exc:
        logger.warning(f"EmailJS send failed (non-fatal): {exc}")
        return False


def generate_meeting_proposal(
    checklist: dict,
    calendly_link: str | None,
    org_name: str,
) -> str:
    """
    Generate a meeting scheduling message with Calendly link.
    Returns formatted text to include in the AI reply.
    """
    name = checklist.get("name", "there")

    if calendly_link:
        return (
            f"I'd love to schedule a quick call to walk you through how {org_name} "
            f"can help {checklist.get('company', 'your team')}. "
            f"You can pick a time that works for you here: {calendly_link}"
        )
    else:
        return (
            f"I'd love to set up a quick call to discuss your requirements in detail. "
            f"A member of our team will reach out to {name} shortly to schedule a convenient time."
        )


async def fire_qualified_lead_notifications(
    checklist: dict,
    session_id: str,
    org_name: str,
    integration: dict | None,
) -> None:
    """
    Fire Slack + generic webhook notifications when a lead qualifies.
    """
    if not integration:
        return

    lead_info = {
        "event": "lead_qualified",
        "session_id": session_id,
        "qualification": checklist,
        "org_name": org_name,
    }

    # Slack notification
    slack_webhook = integration.get("slack_webhook")
    if slack_webhook:
        try:
            payload = {
                "text": (
                    f"🟢 *Qualified Lead!*\n"
                    f"*Name:* {checklist.get('name', 'Unknown')}\n"
                    f"*Company:* {checklist.get('company', 'Unknown')}\n"
                    f"*Role:* {checklist.get('role', 'Unknown')}\n"
                    f"*Use Case:* {checklist.get('use_case', 'Unknown')}\n"
                    f"*Company Size:* {checklist.get('company_size', 'Unknown')}\n"
                    f"*Timeline:* {checklist.get('timeline', 'Unknown')}\n"
                    f"*Session:* `{session_id[:12]}...`"
                ),
            }
            async with httpx.AsyncClient(timeout=5) as client:
                await client.post(slack_webhook, json=payload)
            logger.info("Slack notification sent for qualified lead")
        except Exception as exc:
            logger.warning(f"Slack webhook failed (non-fatal): {exc}")

    # Generic webhook
    webhook_url = integration.get("webhook_url")
    if webhook_url:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                await client.post(webhook_url, json=lead_info)
            logger.info(f"Webhook fired to {webhook_url[:40]}...")
        except Exception as exc:
            logger.warning(f"Generic webhook failed (non-fatal): {exc}")
