"""
LLM response generation — Groq Cloud with full conversation context.
Uses intent state and persona to adapt tone. Never hallucinate:
only answers from KB content provided in the context.
"""

from groq import AsyncGroq

STATE_INSTRUCTIONS = {
    "Exploring": (
        "The buyer is in early exploration. Be helpful and educational. "
        "Do NOT mention pricing or scheduling. Ask one gentle clarifying question."
    ),
    "Comparing": (
        "The buyer is comparing options. Highlight differentiation. "
        "Share relevant specs or case studies. Do NOT push for a meeting yet."
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
) -> str:
    """
    Generate an AI reply using Groq with full conversation context,
    KB resource (if found), persona, and intent-state-specific guidance.
    """
    resource_context = ""
    if kb_resource:
        resource_context = (
            f"\nRelevant information from our knowledge base:\n"
            f"{kb_resource['excerpt']}\n"
            f"Source: {kb_resource['source_file']}"
        )

    persona_context = f"\nBuyer persona detected: {persona}" if persona else ""

    system_prompt = (
        f"You are the AI sales assistant for {org_name}. \n"
        f"You are helpful, warm, and never pushy. You only answer questions "
        f"using the provided knowledge base information.\n"
        f"If you don't have information about something, say so honestly — "
        f"never make up facts.\n"
        f"Keep responses concise (2-4 sentences max). No bullet points unless listing features."
        f"{persona_context}\n"
        f"Stage guidance: {STATE_INSTRUCTIONS[intent_state]}"
    )

    messages = [{"role": "system", "content": system_prompt}]

    # Include last 6 turns for context
    for turn in conversation_history[-6:]:
        messages.append({"role": turn["role"], "content": turn["content"]})

    messages.append({"role": "user", "content": message + resource_context})

    client = AsyncGroq(api_key=groq_api_key)
    response = await client.chat.completions.create(
        model="llama-3.1-70b-versatile",
        messages=messages,
        max_tokens=200,
        temperature=0.4,
    )

    return response.choices[0].message.content.strip()
