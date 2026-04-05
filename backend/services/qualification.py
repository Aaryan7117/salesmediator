"""
Qualification Engine — Explicit Criteria Verification.

Replaces the intent scoring pipeline with structured field extraction.
Uses LLM to extract name, company, role, use_case, company_size, timeline
from each message, then evaluates against org-configurable criteria.
"""

import json
import logging
import re
from groq import AsyncGroq

logger = logging.getLogger(__name__)

# ── Default criteria (used when org hasn't configured custom ones) ──
# Only text fields required by default. Numeric conditions (company_size,
# timeline) are optional — orgs add them via the qualification_criteria table.
DEFAULT_REQUIRED_FIELDS = ["name", "email", "company", "role", "use_case"]
DEFAULT_CONDITIONS: list[dict] = []  # No numeric gates by default

# ── Regex pre-extractors (fast, no LLM call needed) ──
COMPANY_SIZE_PATTERNS = [
    r"(\d{1,5})\s*(?:people|employees|reps|users|seats|staff|team\s*members|developers|engineers)",
    r"(?:team|company)\s*(?:of|has|with)\s*(?:about|around|roughly|~)?\s*(\d{1,5})",
    r"(?:we\s*(?:have|are)|there\s*(?:are|is))\s*(?:about|around|roughly|~)?\s*(\d{1,5})\s*(?:of\s*us|people|employees)",
]

TIMELINE_PATTERNS = [
    (r"(?:before|by)\s*(?:end\s*of\s*)?q1\b", 3),
    (r"(?:before|by)\s*(?:end\s*of\s*)?q2\b", 6),
    (r"(?:before|by)\s*(?:end\s*of\s*)?q3\b", 9),
    (r"(?:before|by)\s*(?:end\s*of\s*)?q4\b", 12),
    (r"(\d{1,2})\s*(?:month|months)", None),  # dynamic
    (r"(\d{1,2})\s*(?:week|weeks)", None),  # dynamic, convert to months
    (r"(?:asap|immediately|right\s*away|urgent)", 1),
    (r"(?:next\s*month)", 1),
    (r"(?:next\s*quarter)", 3),
    (r"(?:this\s*year|by\s*year\s*end)", 6),
]


def _regex_extract_company_size(message: str) -> int | None:
    """Quick regex extraction of company size from message."""
    msg = message.lower().strip()
    for pattern in COMPANY_SIZE_PATTERNS:
        match = re.search(pattern, msg)
        if match:
            try:
                return int(match.group(1))
            except (ValueError, IndexError):
                continue
    return None


def _regex_extract_timeline(message: str) -> tuple[str | None, int | None]:
    """Extract timeline as human string + months estimate."""
    msg = message.lower().strip()
    for pattern, months in TIMELINE_PATTERNS:
        match = re.search(pattern, msg)
        if match:
            if months is not None:
                return match.group(0), months
            # Dynamic extraction
            try:
                num = int(match.group(1))
                if "week" in match.group(0):
                    m = max(1, num // 4)
                    return f"{num} weeks", m
                return f"{num} months", num
            except (ValueError, IndexError):
                continue
    return None, None


EXTRACTION_PROMPT = """You are a data extraction assistant. Extract structured information from the latest message in this conversation.

Previous information already collected:
{existing_checklist}

Latest message from visitor: "{message}"

Extract ONLY NEW information mentioned in the latest message. Return a JSON object with these fields (set to null if NOT mentioned in this message):
- "name": string or null (the visitor's personal name)
- "email": string or null (email address, e.g. "john@acme.com")
- "company": string or null (company/organization name)
- "role": string or null (job title or role)
- "use_case": string or null (what they need the product for)
- "company_size": integer or null (number of employees/users)
- "timeline": string or null (when they need it, e.g. "2 months", "Q2", "ASAP")
- "timeline_months": integer or null (estimated months, e.g. "Q2" = 6, "2 months" = 2, "ASAP" = 1)

RULES:
- Only extract what is EXPLICITLY stated, never infer or guess
- If they say "I'm John from Acme", extract name="John", company="Acme"
- If they say "we have 200 people", extract company_size=200
- If they say "my email is john@acme.com", extract email="john@acme.com"
- Return ONLY the JSON object, no explanation
"""


async def extract_fields_llm(
    message: str,
    existing_checklist: dict,
    conversation: list[dict],
    groq_api_key: str,
) -> dict:
    """
    Use LLM to extract structured qualification fields from a message.
    Returns a dict of newly extracted fields (nulls filtered out).
    """
    prompt = EXTRACTION_PROMPT.format(
        existing_checklist=json.dumps(existing_checklist, indent=2),
        message=message,
    )

    client = AsyncGroq(api_key=groq_api_key)
    try:
        response = await client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are a precise data extraction tool. Return only valid JSON."},
                {"role": "user", "content": prompt},
            ],
            max_tokens=200,
            temperature=0.1,
        )
        raw = response.choices[0].message.content.strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = re.sub(r"^```(?:json)?\s*", "", raw)
            raw = re.sub(r"\s*```$", "", raw)

        extracted = json.loads(raw)
        # Filter out null values
        return {k: v for k, v in extracted.items() if v is not None}
    except Exception as exc:
        logger.warning(f"LLM field extraction failed: {exc}")
        return {}


def merge_checklist(existing: dict, new_fields: dict) -> dict:
    """Merge newly extracted fields into the existing checklist. Never overwrite with None."""
    updated = dict(existing)
    for key, value in new_fields.items():
        if value is not None:
            updated[key] = value
    return updated


def evaluate_qualification(
    checklist: dict,
    required_fields: list[str] | None = None,
    conditions: list[dict] | None = None,
) -> str:
    """
    Evaluate qualification status against org criteria.
    Returns: "collecting", "qualified", or "unqualified"
    """
    req = required_fields or DEFAULT_REQUIRED_FIELDS
    conds = conditions or DEFAULT_CONDITIONS

    # Check if all required fields are collected
    for field in req:
        if not checklist.get(field):
            return "collecting"

    # Evaluate conditions
    for cond in conds:
        field = cond["field"]
        op = cond["op"]
        target = cond["value"]
        actual = checklist.get(field)

        if actual is None:
            return "collecting"  # Still missing data for conditions

        try:
            if op == ">=" and float(actual) < float(target):
                return "unqualified"
            elif op == "<=" and float(actual) > float(target):
                return "unqualified"
            elif op == ">" and float(actual) <= float(target):
                return "unqualified"
            elif op == "<" and float(actual) >= float(target):
                return "unqualified"
            elif op == "==" and str(actual).lower() != str(target).lower():
                return "unqualified"
        except (ValueError, TypeError):
            # Can't evaluate numerically, skip
            continue

    return "qualified"


def get_missing_fields(
    checklist: dict,
    required_fields: list[str] | None = None,
    conditions: list[dict] | None = None,
) -> list[str]:
    """Get list of fields still needed for qualification."""
    req = required_fields or DEFAULT_REQUIRED_FIELDS
    conds = conditions or DEFAULT_CONDITIONS

    missing = []
    for field in req:
        if not checklist.get(field):
            missing.append(field)

    for cond in conds:
        field = cond["field"]
        if not checklist.get(field):
            # Map internal names to user-friendly names
            friendly = {
                "company_size": "company_size",
                "timeline_months": "timeline",
            }
            missing.append(friendly.get(field, field))

    return list(dict.fromkeys(missing))  # deduplicate


async def extract_qualification(
    message: str,
    conversation: list[dict],
    existing_checklist: dict,
    groq_api_key: str,
    org_criteria: dict | None = None,
) -> tuple[dict, str, list[str]]:
    """
    Main qualification extraction pipeline.

    Args:
        message: Current user message
        conversation: Full conversation history
        existing_checklist: Previously extracted fields
        groq_api_key: Groq API key
        org_criteria: Optional org-specific criteria from Supabase

    Returns:
        (updated_checklist, qualification_status, missing_fields)
    """
    # Parse org criteria
    required_fields = None
    conditions = None
    if org_criteria:
        required_fields = org_criteria.get("required_fields") or DEFAULT_REQUIRED_FIELDS
        conditions = org_criteria.get("conditions") or DEFAULT_CONDITIONS

    # Step 1: Regex pre-extraction (fast)
    regex_fields = {}
    size = _regex_extract_company_size(message)
    if size is not None:
        regex_fields["company_size"] = size

    timeline_str, timeline_months = _regex_extract_timeline(message)
    if timeline_str:
        regex_fields["timeline"] = timeline_str
    if timeline_months is not None:
        regex_fields["timeline_months"] = timeline_months

    # Step 2: LLM extraction (for name, company, role, use_case + verification)
    llm_fields = await extract_fields_llm(message, existing_checklist, conversation, groq_api_key)

    # Step 3: Merge (regex takes precedence for numeric values)
    new_fields = {**llm_fields, **regex_fields}
    updated_checklist = merge_checklist(existing_checklist, new_fields)

    # Step 4: Evaluate against org criteria
    status = evaluate_qualification(updated_checklist, required_fields, conditions)
    missing = get_missing_fields(updated_checklist, required_fields, conditions)

    logger.info(
        f"Qualification: status={status}, "
        f"checklist={json.dumps(updated_checklist)}, "
        f"missing={missing}"
    )

    return updated_checklist, status, missing
