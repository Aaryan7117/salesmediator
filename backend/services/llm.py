"""
LLM response generation — Groq Cloud with full conversation context.
V3: Explicit Criteria Verification with precise missing-field prompting.
"""

import logging
from groq import AsyncGroq
from config import settings

logger = logging.getLogger(__name__)


async def generate_reply(
    message: str,
    conversation_history: list[dict],
    qualification_status: str,
    missing_fields: list[str],
    persona: str | None,
    kb_resources_text: list[dict] | None,
    structured_resources: list[dict] | None,
    org_name: str,
    groq_api_key: str,
) -> str:
    """
    Generate an AI reply based on precise qualification status and explicit fields.
    """
    resource_context = ""
    if kb_resources_text:
        resource_context = "\nRelevant text from knowledge base:\n"
        for resource in kb_resources_text:
            resource_context += f"- {resource.get('content')}\n"

    persona_context = f"\nBuyer persona detected: {persona}" if persona else ""

    if qualification_status == "collecting":
        guidance = (
            f"The buyer's qualification is INCCOMPLETE. We still need to find out about: {missing_fields}. "
            f"Naturally weave in ONE clarifying question explicitly to gather ONE of those missing details. "
            f"Do NOT offer a demo, meeting, or email confirmation yet."
        )
    elif qualification_status == "qualified":
        guidance = (
            "The buyer is QUALIFIED! They meet the criteria. Be warm and direct. "
            "Say that you'll send confirmation details and let's get a meeting scheduled. "
            "Do NOT ask any more qualifying questions."
        )
    else:  # unqualified
        res_list = ", ".join([r['title'] for r in (structured_resources or [])])
        guidance = (
            "The buyer is UNQUALIFIED because they did not meet our criteria. "
            f"Politely share these exact resources with them: {res_list}. "
            "Tell them these will help. Do NOT offer a meeting."
        )

    system_prompt = (
        f"You are the AI sales orchestrator for {org_name}. "
        f"You are helpful, warm, and never pushy. Answer naturally based strictly on the Stage constraints below.\n\n"
        f"STRATEGY INSTRUCTION: {guidance}\n"
        f"{persona_context}"
    )

    messages = [{"role": "system", "content": system_prompt}]

    for turn in conversation_history[-6:]:
        messages.append({"role": turn.get("role", "user"), "content": turn["content"]})

    messages.append({"role": "user", "content": message + "\n" + resource_context})

    client = AsyncGroq(api_key=groq_api_key)
    try:
        response = await client.chat.completions.create(
            model=settings.groq_model,
            messages=messages,
            max_tokens=250,
            temperature=0.3,
        )
        return response.choices[0].message.content.strip()
    except Exception as exc:
        logger.error(f"Groq API error: {exc}")
        return "I apologize, but I am experiencing an issue responding. Please try again."
