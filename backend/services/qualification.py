import json
import logging
from groq import AsyncGroq
from supabase_client import get_supabase

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
- "company_size" (integer or null): A number representing total employees (e.g., 50, 200).
- "timeline" (string or null): A description of their timeline (e.g., "3 months", "Q4", "ASAP").

Respond with ONLY valid JSON (no markdown fences, no extra text):
{{
  "name": "...",
  "company": "...",
  "role": "...",
  "use_case": "...",
  "company_size": 100,
  "timeline": "3 months"
}}
"""

def load_qualification_criteria(org_id: str) -> tuple[list[str], list[dict]]:
    """
    Fetch org-specific qualification criteria from Supabase.
    Returns (required_fields, conditions).
    """
    sb = get_supabase()
    result = sb.table("qualification_criteria").select("*").eq("org_id", org_id).execute()
    
    if result.data:
        record = result.data[0]
        return record.get("required_fields", []), record.get("conditions", [])
    
    # Default fallback if org has none
    return (
        ["name", "company", "role", "use_case"],
        [
            {"field": "company_size", "op": ">=", "value": 50},
            {"field": "timeline", "op": "contains", "value": "months"} # simple fallback
        ]
    )

def evaluate_conditions(checklist: dict, required_fields: list[str], conditions: list[dict]) -> str:
    """
    Evaluates checklist against required fields + logical conditions.
    Returns: "qualified", "unqualified", or "collecting"
    """
    # 1. Missing required string fields?
    for rf in required_fields:
        if not checklist.get(rf):
            return "collecting"
            
    # 2. Check logical conditions
    for cond in conditions:
        field = cond["field"]
        op = cond["op"]
        val = cond["value"]
        
        actual_val = checklist.get(field)
        
        # If a condition field hasn't been collected yet, we are still collecting.
        if actual_val is None:
            return "collecting"
            
        try:
            if op == ">=":
                if float(actual_val) < float(val):
                    return "unqualified"
            elif op == "<=":
                if float(actual_val) > float(val):
                    return "unqualified"
            elif op == "==":
                if str(actual_val).lower() != str(val).lower():
                    return "unqualified"
            elif op == "contains":
                if str(val).lower() not in str(actual_val).lower():
                    return "unqualified"
        except (ValueError, TypeError):
            # If parsing fails for numeric, assume unqualified for now
            return "unqualified"
            
    # If all required fields exist and all conditions pass:
    return "qualified"

async def extract_and_evaluate(
    org_id: str,
    conversation_context: list[dict],
    groq_api_key: str,
    groq_model: str = "llama-3.1-70b-versatile",
) -> tuple[dict, str]:
    """
    Loads criteria, extracts fields via LLM, merges with existing rules, and returns updated checklist & status.
    """
    required_fields, conditions = load_qualification_criteria(org_id)
    
    # LLM Extraction
    context_lines = []
    for turn in conversation_context:
        role = "Buyer" if turn["role"] == "user" else "Agent"
        context_lines.append(f"{role}: {turn['content']}")
    context_str = "\n".join(context_lines) if context_lines else "No prior context"

    prompt = QUALIFICATION_EXTRACTION_PROMPT.format(
        conversation_context=context_str
    )

    try:
        client = AsyncGroq(api_key=groq_api_key)
        response = await client.chat.completions.create(
            model=groq_model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=300,
            temperature=0.1,
        )

        raw = response.choices[0].message.content.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
            if raw.endswith("```"):
                raw = raw[:-3]
            raw = raw.strip()

        checklist = json.loads(raw)
    except Exception as exc:
        logger.error(f"Extraction failed: {exc}")
        checklist = {
            "name": None, "company": None, "role": None,
            "use_case": None, "company_size": None, "timeline": None
        }

    status = evaluate_conditions(checklist, required_fields, conditions)
    
    logger.info(f"Checklist: {checklist} | Status: {status}")
    return checklist, status
