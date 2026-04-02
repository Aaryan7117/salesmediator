"""
Conversation Memory — rolling summary window.

Instead of only sending the last 6 raw turns to the LLM, this module:
1. Every N turns, generates a compressed summary of the conversation so far
2. Extracts key facts (team size, timeline, competitors, objections)
3. Sends summary + last 4 turns to the LLM, giving it full context

This solves the "context window" constraint — long sales conversations
don't lose important information.
"""

import json
import logging

logger = logging.getLogger(__name__)

SUMMARY_PROMPT = """Summarize this B2B sales conversation so far in 2-3 sentences. Focus on:
- What the buyer is looking for
- Key facts mentioned (team size, timeline, budget, competitors)
- Any objections or hesitations
- Current stage (exploring, comparing, ready to buy)

Conversation:
{conversation}

Also extract key facts as JSON. Respond with ONLY valid JSON:
{{
  "summary": "2-3 sentence summary",
  "key_facts": {{
    "team_size": null,
    "timeline": null,
    "budget": null,
    "competitors_mentioned": [],
    "product_interest": "",
    "role_title": null
  }},
  "objections": [],
  "buying_stage": "exploring"
}}
"""


class ConversationMemory:
    """Manages conversation memory with rolling summaries."""

    def __init__(self):
        self.summary: str = ""
        self.key_facts: dict = {}
        self.objections: list[str] = []

    @staticmethod
    async def generate_summary(
        conversation: list[dict],
        groq_api_key: str,
        groq_model: str = "llama-3.1-70b-versatile",
    ) -> dict | None:
        """
        Generate a compressed summary of the conversation.
        Called every 4 new turns to keep context fresh.
        """
        try:
            from groq import AsyncGroq

            conv_text = "\n".join([
                f"{'Buyer' if t['role'] == 'user' else 'Agent'}: {t['content']}"
                for t in conversation
            ])

            client = AsyncGroq(api_key=groq_api_key)
            response = await client.chat.completions.create(
                model=groq_model,
                messages=[{"role": "user", "content": SUMMARY_PROMPT.format(conversation=conv_text)}],
                max_tokens=250,
                temperature=0.2,
            )

            raw = response.choices[0].message.content.strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
                if raw.endswith("```"):
                    raw = raw[:-3]
                raw = raw.strip()

            result = json.loads(raw)
            logger.info(f"Memory summary generated: {result.get('summary', '')[:80]}...")
            return result

        except Exception as exc:
            logger.warning(f"Memory summary failed (non-fatal): {type(exc).__name__}: {exc}")
            return None

    @staticmethod
    def build_context_window(
        conversation: list[dict],
        summary: str | None = None,
        recent_turns: int = 4,
    ) -> list[dict]:
        """
        Build an optimized context window for the LLM.
        If a summary exists, prepend it, then include last N turns.
        Otherwise, fall back to last 6 turns.
        """
        if summary and len(conversation) > recent_turns:
            context = [{"role": "system", "content": f"Conversation summary so far: {summary}"}]
            context.extend(conversation[-recent_turns:])
            return context
        else:
            return conversation[-6:]

    @staticmethod
    def should_summarize(conversation: list[dict]) -> bool:
        """Check if we should generate a new summary (every 8 messages)."""
        user_count = sum(1 for t in conversation if t["role"] == "user")
        return user_count > 0 and user_count % 4 == 0
