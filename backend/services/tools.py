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


EMAIL_DRAFT_PROMPT = """You are drafting a professional meeting confirmation email for a qualified sales lead.

Lead Information:
- Name: {name}
- Company: {company}
- Role: {role}
- Use Case: {use_case}
- Company Size: {company_size}
- Timeline: {timeline}

Organization: {org_name}
Meeting Link: {meeting_link}

Write a brief, warm confirmation email (3-5 paragraphs) that:
1. Thanks them for their interest in {org_name}
2. Confirms we understand their use case: "{use_case}"
3. Includes the meeting scheduling link: {meeting_link} — tell them to pick a time slot that works (the meeting will include a Google Meet link)
4. Mentions what they can expect in the meeting (quick demo, Q&A, next steps)
5. Signs off professionally as "The {org_name} Team"

Keep it concise, professional, and personalized. Do NOT include a subject line — just the email body.
"""


async def draft_confirmation_email(
    checklist: dict,
    org_name: str,
    groq_api_key: str,
    calendly_link: str | None = None,
) -> str:
    """
    Use LLM to generate a personalized meeting confirmation email for the visitor.
    Returns the email body text.
    """
    meeting_url = calendly_link or "a link shared by our team shortly"

    prompt = EMAIL_DRAFT_PROMPT.format(
        name=checklist.get("name", "there"),
        company=checklist.get("company", "your organization"),
        role=checklist.get("role", "your team"),
        use_case=checklist.get("use_case", "your needs"),
        company_size=checklist.get("company_size", "your team"),
        timeline=checklist.get("timeline", "your timeline"),
        org_name=org_name,
        meeting_link=meeting_url,
    )

    client = AsyncGroq(api_key=groq_api_key)
    try:
        response = await client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are a professional business email writer. Write concise, warm, meeting-confirmation emails."},
                {"role": "user", "content": prompt},
            ],
            max_tokens=500,
            temperature=0.3,
        )
        email_body = response.choices[0].message.content.strip()
        logger.info(f"Meeting confirmation email drafted for {checklist.get('name', 'lead')}")
        return email_body
    except Exception as exc:
        logger.error(f"Email drafting failed: {exc}")
        meeting_text = f"\n\nSchedule your meeting here: {meeting_url}" if calendly_link else ""
        return (
            f"Hi {checklist.get('name', 'there')},\n\n"
            f"Thank you for your interest in {org_name}! We've reviewed your requirements "
            f"and would love to discuss how we can help "
            f"{checklist.get('company', 'your organization')} with {checklist.get('use_case', 'your needs')}.\n\n"
            f"We'd like to set up a quick meeting to walk you through a demo and answer any questions. "
            f"The meeting will include a Google Meet link for easy video calling."
            f"{meeting_text}\n\n"
            f"Looking forward to connecting!\n\n"
            f"Best regards,\nThe {org_name} Team"
        )


async def send_email_via_emailjs(
    checklist: dict,
    email_body: str,
    org_name: str,
    admin_email: str | None = None,
    send_to_client: bool = True,
) -> bool:
    """
    Send meeting confirmation email via EmailJS.
    
    - If send_to_client=True: sends to the VISITOR's email (from checklist)
    - Also sends a copy to the admin for internal tracking
    
    Returns True if sent successfully.
    """
    EMAILJS_SERVICE_ID = "service_8amqupr"
    EMAILJS_TEMPLATE_ID = "template_q5ymk3f"
    EMAILJS_PUBLIC_KEY = "VEcCEOkf_84PhAjkD"

    # Determine recipient — client email from qualification checklist
    client_email = checklist.get("email")
    recipient_email = client_email if (send_to_client and client_email) else (admin_email or "hw71111111@gmail.com")
    recipient_name = checklist.get("name", "Valued Lead")

    try:
        # Send to client/visitor
        payload = {
            "service_id": EMAILJS_SERVICE_ID,
            "template_id": EMAILJS_TEMPLATE_ID,
            "user_id": EMAILJS_PUBLIC_KEY,
            "template_params": {
                "to_name": recipient_name,
                "to_email": recipient_email,
                "company": checklist.get("company", ""),
                "from_name": f"{org_name} Team",
                "message": email_body,
                "email": recipient_email,
                "subject": f"Meeting Confirmation - {org_name}",
            },
        }
        async with httpx.AsyncClient(timeout=10) as http_client:
            resp = await http_client.post(
                "https://api.emailjs.com/api/v1.6/email/send",
                json=payload,
                headers={"Content-Type": "application/json"},
            )
            if resp.status_code == 200:
                logger.info(f"📧 Meeting confirmation sent to {recipient_email} for {recipient_name}")

                # Also notify admin if we sent to client
                if send_to_client and client_email and admin_email:
                    admin_payload = {
                        "service_id": EMAILJS_SERVICE_ID,
                        "template_id": EMAILJS_TEMPLATE_ID,
                        "user_id": EMAILJS_PUBLIC_KEY,
                        "template_params": {
                            "to_name": "Sales Team",
                            "to_email": admin_email,
                            "company": checklist.get("company", ""),
                            "from_name": "SalesGen Bot",
                            "message": (
                                f"🟢 New Qualified Lead!\n\n"
                                f"Name: {checklist.get('name', 'N/A')}\n"
                                f"Email: {client_email}\n"
                                f"Company: {checklist.get('company', 'N/A')}\n"
                                f"Role: {checklist.get('role', 'N/A')}\n"
                                f"Use Case: {checklist.get('use_case', 'N/A')}\n"
                                f"Company Size: {checklist.get('company_size', 'N/A')}\n"
                                f"Timeline: {checklist.get('timeline', 'N/A')}\n\n"
                                f"Meeting confirmation has been sent to the client."
                            ),
                            "email": admin_email,
                            "subject": f"🟢 Qualified Lead: {checklist.get('name', 'Unknown')} from {checklist.get('company', 'Unknown')}",
                        },
                    }
                    resp2 = await http_client.post(
                        "https://api.emailjs.com/api/v1.6/email/send",
                        json=admin_payload,
                        headers={"Content-Type": "application/json"},
                    )
                    if resp2.status_code == 200:
                        logger.info(f"📧 Admin notification sent to {admin_email}")

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
            f"Great news, {name}! I'd love to schedule a quick call to walk you through "
            f"how **{org_name}** can help **{checklist.get('company', 'your team')}**. "
            f"You can pick a time that works for you here: {calendly_link}\n\n"
            f"The meeting will include a **Google Meet** link for easy video calling. "
            f"I've also sent a confirmation email with all the details to your inbox! 📧"
        )
    else:
        return (
            f"I'd love to set up a quick call to discuss your requirements in detail. "
            f"A member of our team will reach out to {name} shortly to schedule a convenient time. "
            f"We'll include a **Google Meet** link for easy video calling."
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
