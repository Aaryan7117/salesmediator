"""
Hybrid Intent Scorer — LLM-augmented intent analysis.

When the regex engine in intent.py detects 0-1 signals (ambiguous message),
this module calls the LLM for structured analysis of IMPLICIT buying signals.

Returns structured output for the chat pipeline to use.
"""

import json
import logging

logger = logging.getLogger(__name__)

INTENT_ANALYSIS_PROMPT = """You are a B2B sales intent analyst. Analyze this buyer message in the context of the conversation.

Conversation context (last few turns):
{conversation_context}

Latest buyer message: "{message}"
Current intent score: {current_score}/100

Respond with ONLY valid JSON (no markdown, no code fences):
{{
  "implicit_signals": ["list of implicit buying signals detected, e.g. 'active_evaluation', 'urgency_implied', 'budget_holder', 'implementation_planning'"],
  "signal_labels": ["human-readable labels for detected signals, e.g. 'Actively evaluating solutions', 'Urgency implied'"],
  "contradiction_detected": false,
  "contradiction_explanation": "",
  "disambiguating_question": "",
  "confidence": 0.5,
  "suggested_delta": 0,
  "reasoning": "brief explanation of your analysis"
}}

Rules:
- implicit_signals: only signals that regex would MISS (no obvious keyword matches)
- contradiction_detected: true if the buyer shows conflicting intent (e.g. "just exploring" + asks pricing)
- disambiguating_question: if contradiction detected, suggest a natural question to clarify
- suggested_delta: score adjustment (-20 to +30), be conservative
- confidence: 0.0-1.0, how confident you are in the analysis
"""


async def llm_intent_analysis(
    message: str,
    conversation_context: list[dict],
    current_score: int,
    groq_api_key: str,
    groq_model: str = "llama-3.1-70b-versatile",
) -> dict | None:
    """
    LLM analyses a buyer message for implicit signals that regex misses.
    Only called when regex finds 0-1 signals (ambiguous case).
    Returns structured analysis dict or None on failure.
    """
    try:
        from groq import AsyncGroq

        # Build conversation context string (last 4 turns)
        context_lines = []
        for turn in conversation_context[-4:]:
            role = "Buyer" if turn["role"] == "user" else "Agent"
            context_lines.append(f"{role}: {turn['content']}")
        context_str = "\n".join(context_lines) if context_lines else "No prior context"

        prompt = INTENT_ANALYSIS_PROMPT.format(
            conversation_context=context_str,
            message=message,
            current_score=current_score,
        )

        client = AsyncGroq(api_key=groq_api_key)
        response = await client.chat.completions.create(
            model=groq_model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=300,
            temperature=0.2,
        )

        raw = response.choices[0].message.content.strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
            if raw.endswith("```"):
                raw = raw[:-3]
            raw = raw.strip()

        result = json.loads(raw)
        logger.info(f"LLM intent analysis: delta={result.get('suggested_delta', 0)}, "
                     f"confidence={result.get('confidence', 0)}, "
                     f"contradiction={result.get('contradiction_detected', False)}")
        return result

    except Exception as exc:
        logger.warning(f"LLM intent analysis failed (non-fatal): {type(exc).__name__}: {exc}")
        return None
