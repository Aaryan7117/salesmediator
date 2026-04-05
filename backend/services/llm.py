"""
LLM response generation — Groq Cloud with qualification-aware prompts.

V3: Sales Intake & Qualification Agent.
Knows which fields are collected, which are missing.
Asks for ONE missing field per turn. When qualified,
announces next steps. When unqualified, shares KB resources.
"""

import logging
from groq import AsyncGroq
from config import settings

logger = logging.getLogger(__name__)


def _build_qualification_guidance(
    qualification_status: str,
    checklist: dict,
    missing_fields: list[str],
    drafted_email: str | None = None,
    meeting_proposal: str | None = None,
    kb_resources: list[dict] | None = None,
) -> str:
    """Build qualification-aware guidance for the LLM."""

    # Format collected fields
    collected = []
    for key, value in checklist.items():
        if value is not None and key != "timeline_months":
            collected.append(f"  - {key}: {value}")
    collected_str = "\n".join(collected) if collected else "  (none yet)"

    if qualification_status == "collecting":
        # Still gathering info — ask for next missing field
        field_questions = {
            "name": "their name",
            "company": "which company or organization they're with",
            "role": "their role or job title",
            "use_case": "what specific problem they're trying to solve or what they need",
            "company_size": "roughly how many people are on their team or in their company",
            "timeline": "when they'd need this up and running",
        }
        next_field = missing_fields[0] if missing_fields else "any remaining details"
        question_hint = field_questions.get(next_field, f"about their {next_field}")

        return (
            f"QUALIFICATION STATUS: Collecting information\n"
            f"Already collected:\n{collected_str}\n"
            f"Still needed: {', '.join(missing_fields)}\n\n"
            f"INSTRUCTION: Answer their question helpfully first. Then naturally ask about {question_hint}. "
            f"Be conversational — do NOT sound like a form. Ask only ONE question per response. "
            f"Never list all missing fields at once."
        )

    elif qualification_status == "qualified":
        return (
            f"QUALIFICATION STATUS: ✅ QUALIFIED — All criteria met!\n"
            f"Collected data:\n{collected_str}\n\n"
            f"INSTRUCTION: The lead is fully qualified. Warmly congratulate them and let them know:\n"
            f"1. You'll be sending a confirmation email with details\n"
            f"2. Offer to schedule a meeting/demo call\n"
            f"Be enthusiastic but professional. This is a big moment!"
        )

    else:  # unqualified
        resource_str = ""
        if kb_resources:
            resource_str = "\nAvailable resources to share:\n"
            for r in kb_resources:
                icon = "🎥" if r.get("type") == "video" else "📄"
                resource_str += f"  {icon} {r['title']} — {r['url']}\n"

        return (
            f"QUALIFICATION STATUS: Does not meet current criteria\n"
            f"Collected data:\n{collected_str}\n"
            f"{resource_str}\n"
            f"INSTRUCTION: Be gracious — do NOT say they're 'unqualified' or rejected. "
            f"Instead, share helpful resources from the list above. "
            f"Mention specific resource titles and URLs. "
            f"Invite them to reach out again as their needs grow."
        )


async def generate_reply(
    message: str,
    conversation_history: list[dict],
    org_name: str,
    groq_api_key: str,
    # Qualification-aware params
    qualification_status: str = "collecting",
    checklist: dict | None = None,
    missing_fields: list[str] | None = None,
    drafted_email: str | None = None,
    meeting_proposal: str | None = None,
    kb_resources: list[dict] | None = None,
    # KB context for product questions
    kb_resource: dict | None = None,
    # Legacy params (still accepted for compat)
    intent_state: str = "Exploring",
    persona: str | None = None,
    pacing_instruction: str | None = None,
    conversation_summary: str | None = None,
    disambiguation_note: str | None = None,
) -> str:
    """
    Generate an AI reply using Groq with qualification-aware prompting.
    """
    # Build KB context for product questions
    resource_context = ""
    if kb_resource:
        resource_context = (
            f"\n\n=== KNOWLEDGE BASE CONTEXT (use ONLY this info to answer) ===\n"
            f"Title: {kb_resource.get('title', 'N/A')}\n"
            f"Content: {kb_resource.get('content', kb_resource.get('excerpt', ''))}\n"
            f"Source: {kb_resource['source_file']}\n"
            f"=== END KNOWLEDGE BASE CONTEXT ===\n"
        )

    # Build qualification guidance
    qual_guidance = _build_qualification_guidance(
        qualification_status=qualification_status,
        checklist=checklist or {},
        missing_fields=missing_fields or [],
        drafted_email=drafted_email,
        meeting_proposal=meeting_proposal,
        kb_resources=kb_resources,
    )

    persona_context = f"\nBuyer persona detected: {persona}" if persona else ""

    # Build conversation summary context
    summary_context = ""
    if conversation_summary:
        summary_context = f"\nConversation context so far: {conversation_summary}"

    system_prompt = (
        f"You are the AI Sales Assistant for {org_name}.\n"
        f"Your goal is to naturally qualify leads through conversation by collecting "
        f"key information about them while being helpful and answering their questions.\n\n"
        f"STRICT RULES:\n"
        f"1. Answer the visitor's question FIRST using ONLY the knowledge base context provided below.\n"
        f"2. Then naturally ask for ONE missing qualification field.\n"
        f"3. NEVER invent, fabricate, or hallucinate URLs, prices, product names, or features.\n"
        f"   - If the knowledge base has the answer, use ONLY that information.\n"
        f"   - If the knowledge base does NOT have the answer, say: 'I don't have that specific information right now, but I'd be happy to connect you with our team.'\n"
        f"4. Never sound like a form or interrogation.\n"
        f"5. Keep responses concise but well-structured.\n"
        f"6. ALWAYS remember previously collected information.\n"
        f"7. DO NOT make up website URLs — only share URLs that appear in the knowledge base context.\n\n"
        f"FORMATTING (use Markdown for readability):\n"
        f"- Use **bold** for key product names, prices, and important terms.\n"
        f"- Use bullet points (- item) when listing 3+ features, plans, or benefits.\n"
        f"- Use numbered lists (1. step) for sequential steps or processes.\n"
        f"- Keep paragraphs short (2-3 sentences each).\n"
        f"- Use line breaks between distinct topics for clarity.\n"
        f"{persona_context}\n\n"
        f"{qual_guidance}"
        f"{summary_context}"
        f"{resource_context}"
    )

    messages = [{"role": "system", "content": system_prompt}]

    # Build context: recent turns
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

    messages.append({"role": "user", "content": message})

    logger.info(f"Calling Groq model={settings.groq_model} with {len(messages)} messages, qual_status={qualification_status}")

    # ── Model fallback chain: primary → fallback → last resort ──
    FALLBACK_MODELS = [
        settings.groq_model,           # Primary: llama-3.3-70b-versatile
        "llama-3.1-8b-instant",        # Fallback: faster, higher rate limits
        "gemma2-9b-it",                # Last resort
    ]

    client = AsyncGroq(api_key=groq_api_key)
    last_error = None

    for model_idx, model in enumerate(FALLBACK_MODELS):
        # Retry with exponential backoff for each model
        for attempt in range(3):
            try:
                response = await client.chat.completions.create(
                    model=model,
                    messages=messages,
                    max_tokens=400,
                    temperature=0.15,
                )
                reply = response.choices[0].message.content.strip()

                # Extract token usage for monitoring
                usage = response.usage
                token_info = {
                    "prompt_tokens": usage.prompt_tokens if usage else 0,
                    "completion_tokens": usage.completion_tokens if usage else 0,
                    "total_tokens": usage.total_tokens if usage else 0,
                    "model": model,
                }
                if model != settings.groq_model:
                    logger.warning(f"Used fallback model '{model}' (primary was rate-limited)")
                logger.info(f"Groq replied: {reply[:80]}... | tokens: {token_info['total_tokens']} | model: {model}")
                return {"reply": reply, "token_usage": token_info}

            except Exception as exc:
                last_error = exc
                error_str = str(exc).lower()
                is_rate_limit = (
                    "rate_limit" in error_str
                    or "429" in error_str
                    or "too many requests" in error_str
                    or "rate limit" in error_str
                    or "tokens per minute" in error_str
                    or "requests per minute" in error_str
                    or "requests per day" in error_str
                )

                if is_rate_limit:
                    if attempt < 2:
                        # Exponential backoff: 2s, 4s
                        wait_time = 2 ** (attempt + 1)
                        logger.warning(
                            f"Rate limited on {model} (attempt {attempt+1}/3). "
                            f"Retrying in {wait_time}s..."
                        )
                        import asyncio
                        await asyncio.sleep(wait_time)
                        continue
                    else:
                        # All retries exhausted for this model, try next model
                        logger.warning(
                            f"Rate limit exhausted for {model} after 3 attempts. "
                            f"{'Falling back to next model...' if model_idx < len(FALLBACK_MODELS) - 1 else 'No more fallbacks.'}"
                        )
                        break  # Break retry loop, move to next model
                else:
                    # Non-rate-limit error — don't retry, propagate
                    logger.error(f"Groq API error ({model}): {type(exc).__name__}: {exc}")
                    raise

    # All models exhausted
    logger.error(f"All models exhausted. Last error: {last_error}")
    raise last_error or Exception("All LLM models rate-limited")
