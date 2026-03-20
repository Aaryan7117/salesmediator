"""
Intent scoring engine.
Analyses each buyer message for buying signals and adjusts the score.
Score is clamped to 0–100 and determines the intent state.
"""

import re

SIGNAL_WEIGHTS: dict[str, int] = {
    r"(need\s+this\s+by|deadline|before\s+end|q[1-4]\b|next\s+(month|quarter)|urgent|asap)": 25,
    r"(compar|vs\.?|versus|better\s+than|competitor|alternative|other\s+option|how\s+do\s+you\s+stack)": 20,
    r"(pric|cost|budget|how\s+much|roi|return\s+on|invest|afford)": 18,
    r"(\b\d{1,4}\s*(people|reps|users|seats|employees|staff|team\s+members))": 15,
    r"(demo|free\s+trial|pilot|proof\s+of\s+concept|\bpoc\b|test\s+it\s+out)": 15,
    r"(integrat|api\b|crm\b|connect|sync\b|plugin|webhook|salesforce|hubspot)": 12,
    r"^\s*(ok|okay|sure|thanks|got\s+it|understood|cool|noted)\s*$": -5,
    r"(just\s+(looking|browsing|curious)|not\s+sure\s+yet|maybe\s+someday|no\s+rush|just\s+exploring)": -10,
}

SIGNAL_LABELS: dict[str, str] = {
    r"(need\s+this\s+by|deadline|before\s+end|q[1-4]\b|next\s+(month|quarter)|urgent|asap)": "Timeline mentioned",
    r"(compar|vs\.?|versus|better\s+than|competitor|alternative|other\s+option|how\s+do\s+you\s+stack)": "Competitor compare",
    r"(pric|cost|budget|how\s+much|roi|return\s+on|invest|afford)": "Pricing probe",
    r"(\b\d{1,4}\s*(people|reps|users|seats|employees|staff|team\s+members))": "Team size mentioned",
    r"(demo|free\s+trial|pilot|proof\s+of\s+concept|\bpoc\b|test\s+it\s+out)": "Demo interest",
    r"(integrat|api\b|crm\b|connect|sync\b|plugin|webhook|salesforce|hubspot)": "Integration query",
}


def score_intent(message: str, current_score: int) -> tuple[int, list[str]]:
    """
    Score a buyer message for purchase intent signals.
    Returns (new_score, list_of_triggered_signal_labels).
    """
    triggered: list[str] = []
    delta = 0
    msg = message.lower().strip()

    for pattern, weight in SIGNAL_WEIGHTS.items():
        if re.search(pattern, msg):
            delta += weight
            label = SIGNAL_LABELS.get(pattern)
            if label:
                triggered.append(label)

    new_score = max(0, min(100, current_score + delta))
    return new_score, triggered


def get_intent_state(score: int) -> str:
    """Map an intent score to a human-readable state."""
    if score <= 40:
        return "Exploring"
    if score <= 75:
        return "Comparing"
    return "Decision-Ready"
