"""
LLM response generation — Groq Cloud with full conversation context.
V2: Now uses pacing-aware instructions, conversation summaries,
and disambiguation notes for contradiction handling.
"""

import logging
from groq import AsyncGroq
from config import settings

logger = logging.getLogger(__name__)

STATE_INSTRUCTIONS = {
    "Exploring": (
        "The buyer is in early exploration. Answer their questions directly using the knowledge base. "
        "End with one gentle clarifying question to learn about their goals or team size."
    ),
    "Comparing": (
        "The buyer is comparing options. Highlight differentiation based on the KB. "
        "Share relevant specs, pricing, or case studies directly."
    ),
    "Decision-Ready": (
        "The buyer is ready. Be warm and direct. A scheduling option will be "
        "shown to them separately — do not force it, just be ready to answer final questions."
    ),
}


async def generate_reply(
    message: str,
    conversation_history: list[dict],
    intent_state: str,
    persona: str | None,
    kb_resource: dict | None,
    org_name: str,
    groq_api_key: str,
    pacing_instruction: str | None = None,
    conversation_summary: str | None = None,
    disambiguation_note: str | None = None,
) -> str:
    """
    Generate an AI reply using Groq with:
    - Pacing-aware instructions (multi-threshold)
    - Conversation summary (long conversations)
    - Disambiguation notes (contradiction handling)
    - KB resource context with citations
    """
    resource_context = ""
    if kb_resource:
        resource_context = (
            f"\nRelevant information from our knowledge base:\n"
            f"{kb_resource.get('content', kb_resource.get('excerpt', ''))}\n"
            f"Source: {kb_resource['source_file']}\n"
            f"IMPORTANT: When using this information, cite the source naturally, "
            f"e.g. 'According to our documentation...'"
        )

    persona_context = f"\nBuyer persona detected: {persona}" if persona else ""

    # Use pacing instruction if available, otherwise fall back to state instructions
    guidance = pacing_instruction or f"Stage guidance: {STATE_INSTRUCTIONS[intent_state]}"

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
        f"You are the AI sales assistant for {org_name}. \n"
        f"You are helpful, warm, and never pushy. You only answer questions "
        f"using the provided knowledge base information.\n"
        f"If you don't have information about something, say so honestly — "
        f"never make up facts.\n"
        f"Keep responses concise (2-4 sentences max). No bullet points unless listing features."
        f"{persona_context}\n"
        f"{guidance}"
        f"{summary_context}"
        f"{disambiguation_context}"
    )

    messages = [{"role": "system", "content": system_prompt}]

    # Build context: summary + recent turns (if summary exists), or last 6 turns
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

    messages.append({"role": "user", "content": message + resource_context})

    logger.info(f"Calling Groq model={settings.groq_model} with {len(messages)} messages")

    client = AsyncGroq(api_key=groq_api_key)
    try:
        response = await client.chat.completions.create(
            model=settings.groq_model,
            messages=messages,
            max_tokens=250,
            temperature=0.4,
        )
        reply = response.choices[0].message.content.strip()
        logger.info(f"Groq replied successfully: {reply[:80]}...")
        return reply
    except Exception as exc:
        logger.error(f"Groq API error: {type(exc).__name__}: {exc}")
        raise
