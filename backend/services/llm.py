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
            f"\nRelevant information from our knowledge base:\n"
            f"{kb_resource.get('content', kb_resource.get('excerpt', ''))}\n"
            f"Source: {kb_resource['source_file']}\n"
            f"IMPORTANT: When using this information, cite the source naturally, "
            f"e.g. 'According to our documentation...'"
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
        f"You are the AI Sales Intake Agent for {org_name}.\n"
        f"Your goal is to naturally qualify leads through conversation by collecting "
        f"key information about them while being helpful and answering their questions.\n\n"
        f"RULES:\n"
        f"- Always answer the visitor's question FIRST using knowledge base info\n"
        f"- Then naturally ask for ONE missing qualification field\n"
        f"- Never sound like a form or interrogation\n"
        f"- Only use information from the provided knowledge base — never make up facts\n"
        f"- If you don't have information, say so honestly\n"
        f"- Keep responses concise (2-4 sentences). No bullet points unless listing features.\n"
        f"- ALWAYS remember previously collected information (context retention)\n"
        f"- When sharing resources, include the actual URLs\n"
        f"{persona_context}\n\n"
        f"{qual_guidance}"
        f"{summary_context}"
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

    messages.append({"role": "user", "content": message + resource_context})

    logger.info(f"Calling Groq model={settings.groq_model} with {len(messages)} messages, qual_status={qualification_status}")

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
