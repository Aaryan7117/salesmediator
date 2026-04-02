"""
SalesGen Demo Seed Script

Seeds the database with realistic demo data so you can showcase
the full platform immediately. Run this after deploying.

Creates:
- A demo org "NovaCRM" with slug "novacrm"
- 5 leads at various intent stages with realistic conversations
- Widget config with NovaCRM branding
- Integration config with sample Calendly link
- Intent history for timeline charts

Usage:
  python seed_demo.py
"""

import os
import sys
import uuid
from datetime import datetime, timezone, timedelta

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from supabase_client import get_supabase


def seed():
    sb = get_supabase()
    print("🌱 Seeding SalesGen demo data...")

    # ── 1. Create demo org ──
    org_id = str(uuid.uuid4())
    sb.table("orgs").upsert({
        "id": org_id,
        "name": "NovaCRM",
        "slug": "novacrm",
    }).execute()
    print(f"  ✓ Org: NovaCRM (slug: novacrm)")

    # ── 2. Widget config ──
    sb.table("widget_config").upsert({
        "org_id": org_id,
        "bot_name": "Nova AI",
        "greeting": "Hey there! 👋 I'm Nova, your AI sales guide. How can I help you today?",
        "brand_color": "#6366f1",
        "position": "right",
    }).execute()
    print("  ✓ Widget config set")

    # ── 3. Integration config ──
    sb.table("integrations").upsert({
        "org_id": org_id,
        "calendly_link": "https://calendly.com/novacrm-sales/30min",
    }).execute()
    print("  ✓ Integrations set (Calendly)")

    # ── 4. Seed leads ──
    now = datetime.now(timezone.utc)

    leads = [
        {
            "id": str(uuid.uuid4()),
            "org_id": org_id,
            "session_id": f"demo-{uuid.uuid4().hex[:8]}",
            "persona": "Technical evaluator",
            "intent_score": 82,
            "intent_state": "Decision-Ready",
            "signals": ["Pricing probe", "Team size mentioned", "Timeline mentioned", "Integration query"],
            "calendly_shown": True,
            "conversation": [
                {"role": "user", "content": "Hi, I'm looking at CRM options for our sales team.", "timestamp": (now - timedelta(hours=2)).isoformat()},
                {"role": "assistant", "content": "Welcome! I'd love to help you find the right fit. Could you tell me a bit about your team size and what you're currently using?", "timestamp": (now - timedelta(hours=2, minutes=-1)).isoformat()},
                {"role": "user", "content": "We're about 45 reps. Currently on Salesforce but it's too complex for what we need.", "timestamp": (now - timedelta(hours=1, minutes=50)).isoformat()},
                {"role": "assistant", "content": "I hear that a lot! NovaCRM is designed to be powerful without the complexity. With 45 reps, you'd be on our Growth plan which includes AI lead scoring and pipeline automation. Many teams switching from Salesforce see a 30% reduction in admin time.", "timestamp": (now - timedelta(hours=1, minutes=49)).isoformat()},
                {"role": "user", "content": "That sounds good. How much would it cost for 45 users? And do you integrate with HubSpot?", "timestamp": (now - timedelta(hours=1, minutes=40)).isoformat()},
                {"role": "assistant", "content": "For 45 users on Growth, it's $49/user/month. We have a native HubSpot integration — it syncs contacts, deals, and activities in real-time. Would you like to schedule a quick call to discuss the migration path?", "timestamp": (now - timedelta(hours=1, minutes=39)).isoformat()},
                {"role": "user", "content": "Yes, we need to move by end of Q2. Can I book a demo with your team?", "timestamp": (now - timedelta(hours=1, minutes=30)).isoformat()},
                {"role": "assistant", "content": "Absolutely! With a Q2 timeline, we can get you fully migrated in 2-3 weeks.", "timestamp": (now - timedelta(hours=1, minutes=29)).isoformat()},
            ],
            "resources_served": [{"title": "HubSpot Integration Guide", "source_file": "integrations.pdf", "relevance_score": 92}],
            "updated_at": (now - timedelta(hours=1, minutes=29)).isoformat(),
        },
        {
            "id": str(uuid.uuid4()),
            "org_id": org_id,
            "session_id": f"demo-{uuid.uuid4().hex[:8]}",
            "persona": "Budget-conscious decision maker",
            "intent_score": 58,
            "intent_state": "Comparing",
            "signals": ["Competitor compare", "Pricing probe", "Demo interest"],
            "calendly_shown": False,
            "conversation": [
                {"role": "user", "content": "How does NovaCRM compare to Pipedrive?", "timestamp": (now - timedelta(hours=3)).isoformat()},
                {"role": "assistant", "content": "Great question! Both are excellent CRMs. The key differences: NovaCRM includes AI-powered lead scoring and revenue intelligence that Pipedrive charges extra for. Our pipeline view is also more customizable. Where NovaCRM really shines is for teams of 10+ reps who need forecasting.", "timestamp": (now - timedelta(hours=3, minutes=-1)).isoformat()},
                {"role": "user", "content": "Interesting. What's the pricing like? Pipedrive is at $59/user for their advanced plan.", "timestamp": (now - timedelta(hours=2, minutes=45)).isoformat()},
                {"role": "assistant", "content": "Our Growth plan is $49/user/month and includes everything in Pipedrive's Advanced plan plus AI scoring and email sequences. For a fair comparison, you'd need Pipedrive's Enterprise at $79/user to get similar features. Want me to send a detailed comparison?", "timestamp": (now - timedelta(hours=2, minutes=44)).isoformat()},
            ],
            "resources_served": [{"title": "NovaCRM vs Competitors", "source_file": "comparison.pdf", "relevance_score": 88}],
            "updated_at": (now - timedelta(hours=2, minutes=44)).isoformat(),
        },
        {
            "id": str(uuid.uuid4()),
            "org_id": org_id,
            "session_id": f"demo-{uuid.uuid4().hex[:8]}",
            "persona": "Casual explorer",
            "intent_score": 15,
            "intent_state": "Exploring",
            "signals": ["Demo interest"],
            "calendly_shown": False,
            "conversation": [
                {"role": "user", "content": "What does NovaCRM do?", "timestamp": (now - timedelta(minutes=30)).isoformat()},
                {"role": "assistant", "content": "NovaCRM is an AI-powered sales platform that helps teams manage their pipeline, score leads automatically, and close deals faster. What brings you here today — are you exploring CRM options for your team?", "timestamp": (now - timedelta(minutes=29)).isoformat()},
                {"role": "user", "content": "Just browsing for now, we might need something next quarter.", "timestamp": (now - timedelta(minutes=20)).isoformat()},
                {"role": "assistant", "content": "No worries at all! When you're ready to explore, you can sign up for a free Starter plan with no credit card required. Is there anything specific you'd like to know about in the meantime?", "timestamp": (now - timedelta(minutes=19)).isoformat()},
            ],
            "resources_served": [],
            "updated_at": (now - timedelta(minutes=19)).isoformat(),
        },
        {
            "id": str(uuid.uuid4()),
            "org_id": org_id,
            "session_id": f"demo-{uuid.uuid4().hex[:8]}",
            "persona": "Implementation manager",
            "intent_score": 68,
            "intent_state": "Comparing",
            "signals": ["Integration query", "Team size mentioned", "Pricing probe"],
            "calendly_shown": False,
            "conversation": [
                {"role": "user", "content": "Does NovaCRM have a REST API? We need to connect it to our internal tools.", "timestamp": (now - timedelta(hours=5)).isoformat()},
                {"role": "assistant", "content": "Yes! We have a comprehensive REST API that covers contacts, deals, activities, and webhooks. We also have pre-built connectors for Zapier and Make. What internal tools are you looking to connect?", "timestamp": (now - timedelta(hours=5, minutes=-1)).isoformat()},
                {"role": "user", "content": "Our custom billing system and a Slack bot. We have about 25 reps who would use it.", "timestamp": (now - timedelta(hours=4, minutes=50)).isoformat()},
                {"role": "assistant", "content": "The API would handle both of those well. For Slack, we actually have a native integration that sends deal updates to channels. For billing, you can use webhooks to sync data in real-time. At 25 reps on Growth, you're looking at $49/user/month with full API access included.", "timestamp": (now - timedelta(hours=4, minutes=49)).isoformat()},
            ],
            "resources_served": [{"title": "API Documentation", "source_file": "api-docs.pdf", "relevance_score": 95}],
            "updated_at": (now - timedelta(hours=4, minutes=49)).isoformat(),
        },
        {
            "id": str(uuid.uuid4()),
            "org_id": org_id,
            "session_id": f"demo-{uuid.uuid4().hex[:8]}",
            "persona": "Startup founder",
            "intent_score": 91,
            "intent_state": "Decision-Ready",
            "signals": ["Sales call requested", "Timeline mentioned", "Budget holder", "Pricing probe", "Team size mentioned"],
            "calendly_shown": True,
            "conversation": [
                {"role": "user", "content": "We're a 12-person startup and need a CRM ASAP. We just closed our Series A.", "timestamp": (now - timedelta(minutes=45)).isoformat()},
                {"role": "assistant", "content": "Congratulations on the Series A! 🎉 For a 12-person team, NovaCRM would be perfect — you'd get AI-powered lead scoring, automated sequences, and pipeline management without the enterprise complexity. What's your timeline for getting set up?", "timestamp": (now - timedelta(minutes=44)).isoformat()},
                {"role": "user", "content": "This week if possible. We're hiring SDRs and need to track everything from day one. Budget isn't an issue.", "timestamp": (now - timedelta(minutes=35)).isoformat()},
                {"role": "assistant", "content": "Great timing! You can be fully operational today — NovaCRM has guided onboarding that takes about 20 minutes. For 12 users on Growth, it's $49/user/month, and I can help sort out any data imports you need.", "timestamp": (now - timedelta(minutes=34)).isoformat()},
                {"role": "user", "content": "Perfect. Can I speak to someone on your team to speed things up? I want to get the whole team on this by Friday.", "timestamp": (now - timedelta(minutes=25)).isoformat()},
                {"role": "assistant", "content": "Absolutely! I'll connect you with our onboarding team right away. They specialize in quick setups just like this.", "timestamp": (now - timedelta(minutes=24)).isoformat()},
            ],
            "resources_served": [{"title": "Quick Start Guide", "source_file": "quickstart.pdf", "relevance_score": 90}],
            "updated_at": (now - timedelta(minutes=24)).isoformat(),
        },
    ]

    for lead in leads:
        sb.table("leads").upsert(lead).execute()

    print(f"  ✓ {len(leads)} demo leads created")

    # ── 5. Seed intent history ──
    history_entries = []
    for lead in leads:
        # Generate a few history points
        steps = [
            (1, 0, 15, ["Demo interest"]),
            (2, 15, 35, ["Pricing probe"]),
            (3, 35, lead["intent_score"] - 10, lead["signals"][:2]),
            (4, lead["intent_score"] - 10, lead["intent_score"], lead["signals"]),
        ]
        for turn, before, after, sigs in steps:
            if after <= 0:
                continue
            history_entries.append({
                "lead_id": lead["id"],
                "turn_number": turn,
                "score_before": max(0, before),
                "score_after": max(0, after),
                "signals": sigs,
            })

    for entry in history_entries:
        try:
            sb.table("intent_history").insert(entry).execute()
        except Exception:
            pass  # Skip if intent_history table doesn't exist yet

    print(f"  ✓ {len(history_entries)} intent history entries")

    print("\n✅ Demo seed complete!")
    print(f"   Open demo/novacrm-demo.html in your browser")
    print(f"   Login to dashboard at http://localhost:5173")
    print(f"   Org slug: novacrm")


if __name__ == "__main__":
    seed()
