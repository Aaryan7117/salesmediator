import json
import logging
from groq import AsyncGroq

logger = logging.getLogger(__name__)

QUALIFICATION_EXTRACTION_PROMPT = """You are a B2B sales data extraction analyst.
Analyze the entire conversation below and extract the lead's current qualification details.
You must return the current known state of these specific fields. If a field has not been explicitly mentioned or cannot be confidently inferred from the text, return null for it.

Conversation context:
{conversation_context}

Available data points to extract:
- "name" (string or null): The lead's full or first name.
- "company" (string or null): The lead's company name.
- "role" (string or null): The lead's job title or role.
- "use_case" (string or null): A brief description of what they want to achieve.
- "company_size" (integer or null): A number representing total employees (e.g., 50, 200). If they say "around 100", extract 100. Extract ONLY the number.
- "timeline_months" (integer or null): A number representing the timeline in months (e.g., 1, 3). If they say "2-3 months", extract 3. Extract ONLY the number.

Respond with ONLY valid JSON (no markdown fences, no extra text):
{{
  "name": "...",
  "company": "...",
  "role": "...",
  "use_case": "...",
  "company_size": 100,
  "timeline_months": 3
}}
"""

async def extract_qualification_data(
    conversation_context: list[dict],
    groq_api_key: str,
    groq_model: str = "llama-3.1-70b-versatile",
) -> dict:
    """
    Analyzes the conversation history and extracts structured qualification data.
    """
    try:
        # Build conversation context string
        context_lines = []
        for turn in conversation_context:
            role = "Buyer" if turn["role"] == "user" else "Agent"
            context_lines.append(f"{role}: {turn['content']}")
        context_str = "\n".join(context_lines) if context_lines else "No prior context"

        prompt = QUALIFICATION_EXTRACTION_PROMPT.format(
            conversation_context=context_str
        )

        client = AsyncGroq(api_key=groq_api_key)
        response = await client.chat.completions.create(
            model=groq_model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=300,
            temperature=0.1,
        )

        raw = response.choices[0].message.content.strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
            if raw.endswith("```"):
                raw = raw[:-3]
            raw = raw.strip()

        result = json.loads(raw)
        logger.info(f"LLM extraction result: {result}")
        return result

    except Exception as exc:
        logger.error(f"Extraction failed: {type(exc).__name__}: {exc}")
        # Return empty state rather than crashing, to allow pipeline to continue naturally
        return {
            "name": None,
            "company": None,
            "role": None,
            "use_case": None,
            "company_size": None,
            "timeline_months": None,
        }
