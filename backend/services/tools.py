import logging
from groq import AsyncGroq

logger = logging.getLogger(__name__)

EMAIL_DRAFT_PROMPT = """You are drafting a B2B sales confirmation email.
Based on the provided qualification details, write a highly professional, concise, and warm confirmation email to the lead.
The email should state that they are a great fit and we're looking forward to speaking with them. 
Include the placeholder {{meeting_link}} exactly as written here, where they can click to schedule.
Do NOT include a Subject line. Start directly with the greeting.

Lead Details:
{details}
"""

async def draft_confirmation_email(checklist: dict, groq_api_key: str, groq_model: str = "llama-3.1-70b-versatile") -> str:
    """
    LLM drafts a personalized confirmation email body from the checklist.
    """
    details_str = "\n".join([f"{k}: {v}" for k, v in checklist.items() if v is not None])
    prompt = EMAIL_DRAFT_PROMPT.format(details=details_str)
    
    try:
        client = AsyncGroq(api_key=groq_api_key)
        response = await client.chat.completions.create(
            model=groq_model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=250,
            temperature=0.3,
        )
        return response.choices[0].message.content.strip()
    except Exception as exc:
        logger.error(f"Email draft failed: {exc}")
        name = checklist.get("name", "there")
        return f"Hi {name},\n\nWe are thrilled to explore how we can help. Please use the link below to find a time:\n\n{{meeting_link}}\n\nBest,\nThe Team"


def generate_meeting_proposal(link: str | None) -> str | None:
    """
    Formats the Calendly link or returns None if disabled.
    """
    if not link:
        return None
    return link
