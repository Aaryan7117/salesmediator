"""
LLM response generation — Groq Cloud with full conversation context.
V3: Explicit Criteria Verification.
"""

import logging
from groq import AsyncGroq
from config import settings

logger = logging.getLogger(__name__)


async def generate_reply(
    message: str,
    conversation_history: list[dict],
    is_qualified: bool | None,
    qualification_data: dict,
    persona: str | None,
    kb_resources: list[dict] | None,
    org_name: str,
    groq_api_key: str,
    conversation_summary: str | None = None,
    disambiguation_note: str | None = None,
) -> str:
    """
    Generate an AI reply using Groq based on explicit qualification state.
    """
    resource_context = ""
    if kb_resources:
        resource_context = "\nRelevant information from our knowledge base:\n"
        for resource in kb_resources:
            resource_context += (
                f"- {resource.get('title', 'Document')} (Source: {resource.get('source_file')}):\n"
                f"  {resource.get('content', resource.get('excerpt', ''))}\n"
            )
        resource_context += "\nIMPORTANT: When using this information, restrict your recommendations or answers STRICTLY to the provided knowledge base above. Cite sources naturally."

    persona_context = f"\nBuyer persona detected: {persona}" if persona else ""

    # Build criteria guidance based on is_qualified State
    if is_qualified is None:
        missing_fields = [k for k, v in qualification_data.items() if v is None]
        guidance = (
            f"The buyer's qualification is incomplete. We are missing info for: {missing_fields}. "
            "Be helpful and answer their questions using the knowledge base. "
            "IMPORTANT: End with naturally asking ONE clarifying question to gather some of the missing information. "
            "Do NOT offer a demo, meeting, or email confirmation yet."
        )
    elif is_qualified is True:
        guidance = (
            "The buyer is QUALIFIED. Be warm and direct. "
            "Acknowledge that they are a great fit. Naturally draft a short confirmation email for them "
            "and let them know you are providing a meeting scheduling option to their email."
            "Do NOT ask any more qualifying questions."
        )
    else:
        guidance = (
            "The buyer is UNQUALIFIED (e.g., they are too small or timeline is too long). "
            "Explain nicely that your primary managed offering might not be the best fit right now, "
            "but you wanted to provide them with some helpful educational resources. "
            "Recommend the specific knowledge base resources, platform videos, or spec links provided below. "
            "Do NOT offer a meeting scheduling link."
        )

    # Build disambiguation instruction
    disambiguation_context = ""
    if disambiguation_note:
        disambiguation_context = (
            f"\nIMPORTANT: The buyer's message contains mixed signals. "
            f"Instead of making assumptions, incorporate this natural clarifying question "
            f"into your response: '{disambiguation_note}'"
        )

    # Build conversation summary context
    summary_context = ""
    if conversation_summary:
        summary_context = f"\nConversation context so far: {conversation_summary}"

    system_prompt = (
        f"You are the AI sales orchestrator for {org_name}. \n"
        f"You are helpful, warm, and never pushy. You respond precisely based on the stage criteria.\n"
        f"If you don't have information about something, say so honestly — never make up facts.\n"
        f"Keep responses concise (2-4 sentences max). No bullet points unless listing features or KB resources.\n"
        f"{persona_context}\n"
        f"STRATEGY INSTRUCTION: {guidance}\n"
        f"{summary_context}\n"
        f"{disambiguation_context}"
    )

    messages = [{"role": "system", "content": system_prompt}]

    # Build context: summary + recent turns
    if conversation_summary and len(conversation_history) > 4:
        for turn in conversation_history[-4:]:
            role = turn["role"]
            if role not in ("user", "assistant", "system"):
                role = "user"
            messages.append({"role": role, "content": turn["content"]})
    else:
        for turn in conversation_history[-6:]:
            role = turn["role"]
            if role not in ("user", "assistant", "system"):
                role = "user"
            messages.append({"role": role, "content": turn["content"]})

    messages.append({"role": "user", "content": message + "\n" + resource_context})

    logger.info(f"Calling Groq model={settings.groq_model} with explicit criteria verification")

    client = AsyncGroq(api_key=groq_api_key)
    try:
        response = await client.chat.completions.create(
            model=settings.groq_model,
            messages=messages,
            max_tokens=300,
            temperature=0.4,
        )
        reply = response.choices[0].message.content.strip()
        logger.info(f"Groq replied successfully: {reply[:80]}...")
        return reply
    except Exception as exc:
        logger.error(f"Groq API error: {type(exc).__name__}: {exc}")
        raise
