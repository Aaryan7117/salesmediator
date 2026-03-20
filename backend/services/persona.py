"""
Persona detection — single Groq LLM call.
Classifies a buyer into one of four personas based on their first few messages.
Only called during turns 1–3 to avoid wasting tokens.
"""

from groq import AsyncGroq


async def detect_persona(first_messages: list[str], groq_api_key: str) -> str:
    """
    Classify the buyer into exactly one persona based on their
    opening messages. Returns the persona label as a string.
    """
    combined = " | ".join(first_messages)
    client = AsyncGroq(api_key=groq_api_key)

    response = await client.chat.completions.create(
        model="llama-3.1-70b-versatile",
        messages=[
            {
                "role": "user",
                "content": (
                    "Classify this buyer into exactly one persona based on their messages.\n"
                    "Reply with ONLY the persona label — no explanation, no punctuation, nothing else.\n\n"
                    "Personas:\n"
                    "- Mid-market evaluator (mentions team size, comparing vendors, has decision authority)\n"
                    "- Technical evaluator (asks about APIs, integrations, technical specifications)\n"
                    "- Budget gatekeeper (pricing-first questions, mentions budget constraints, asks about ROI)\n"
                    "- Casual explorer (vague questions, early research, non-committal language)\n\n"
                    f"Buyer messages: {combined}\n\n"
                    "Persona:"
                ),
            }
        ],
        max_tokens=20,
        temperature=0,
    )

    return response.choices[0].message.content.strip()
