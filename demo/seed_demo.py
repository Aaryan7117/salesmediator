"""
SalesGen Demo Seed Script

Seeds the database with realistic demo data so you can showcase
the full platform immediately. Run this after deploying.

Creates:
- A demo org "NovaCRM" with slug "novacrm"
- Qualification criteria for the org
- 6 leads at various qualification stages with realistic conversations
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

    # ── 1. Create or reuse demo org ──
    # Check if "novacrm" already exists
    existing = sb.table("orgs").select("id").eq("slug", "novacrm").execute()
    if existing.data:
        org_id = existing.data[0]["id"]
        print(f"  ✓ Org: NovaCRM already exists (id: {org_id[:8]}...), cleaning old data...")
        # Clean up old leads, history, criteria, kb_resources for this org
        try:
            old_leads = sb.table("leads").select("id").eq("org_id", org_id).execute()
            for lead in (old_leads.data or []):
                sb.table("intent_history").delete().eq("lead_id", lead["id"]).execute()
            sb.table("leads").delete().eq("org_id", org_id).execute()
        except Exception:
            pass
        try:
            sb.table("qualification_criteria").delete().eq("org_id", org_id).execute()
        except Exception:
            pass
        try:
            sb.table("kb_resources").delete().eq("org_id", org_id).execute()
        except Exception:
            pass
        try:
            sb.table("widget_config").delete().eq("org_id", org_id).execute()
        except Exception:
            pass
        try:
            sb.table("integrations").delete().eq("org_id", org_id).execute()
        except Exception:
            pass
        print("  ✓ Old data cleaned")
    else:
        org_id = str(uuid.uuid4())
        sb.table("orgs").insert({
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

    # ── 4. Qualification Criteria ──
    try:
        sb.table("qualification_criteria").upsert({
            "org_id": org_id,
            "required_fields": ["name", "company", "role", "use_case"],
            "conditions": [
                {"field": "company_size", "op": ">=", "value": 10},
                {"field": "timeline_months", "op": "<=", "value": 6},
            ],
        }).execute()
        print("  ✓ Qualification criteria set (name, company, role, use_case + company_size≥10, timeline≤6mo)")
    except Exception as exc:
        print(f"  ⚠ Qualification criteria insert skipped: {exc}")

    # ── 5. KB Resources ──
    try:
        kb_resources = [
            {
                "org_id": org_id,
                "title": "NovaCRM Product Spec Sheet",
                "url": "https://novacrm.io/docs/product-spec",
                "type": "spec",
                "description": "Complete technical specification including AI lead scoring, pipeline automation, and API capabilities.",
            },
            {
                "org_id": org_id,
                "title": "Platform Demo Video",
                "url": "https://youtube.com/watch?v=novacrm-demo",
                "type": "video",
                "description": "Full walkthrough of NovaCRM dashboard, deal tracking, and AI-powered insights.",
            },
            {
                "org_id": org_id,
                "title": "Integration Guide",
                "url": "https://novacrm.io/docs/integrations",
                "type": "doc",
                "description": "Step-by-step guide to integrate NovaCRM with Slack, HubSpot, Calendly, and custom webhooks.",
            },
            {
                "org_id": org_id,
                "title": "Quick Start Tutorial",
                "url": "https://youtube.com/watch?v=novacrm-quickstart",
                "type": "video",
                "description": "5-minute setup guide: import contacts, configure pipeline stages, go live.",
            },
            {
                "org_id": org_id,
                "title": "API Reference",
                "url": "https://novacrm.io/docs/api",
                "type": "spec",
                "description": "Full REST API documentation for contacts, deals, activities, and webhook endpoints.",
            },
        ]
        for r in kb_resources:
            sb.table("kb_resources").upsert(r).execute()
        print(f"  ✓ {len(kb_resources)} KB resources created")
    except Exception as exc:
        print(f"  ⚠ KB resources insert skipped: {exc}")

    # ── 6. Seed leads with mixed qualification statuses ──
    now = datetime.now(timezone.utc)

    leads = [
        # ─── QUALIFIED: Technical evaluator — all criteria met ───
        {
            "id": str(uuid.uuid4()),
            "org_id": org_id,
            "session_id": f"demo-{uuid.uuid4().hex[:8]}",
            "persona": "Technical evaluator",
            "intent_score": 95,
            "intent_state": "Decision-Ready",
            "signals": ["qual_status:qualified", "name:Sarah Chen", "company:DataFlow Inc", "role:VP of Sales", "use_case:Pipeline automation", "company_size:120", "timeline_months:2"],
            "calendly_shown": True,
            "crm_filed": False,
            "qualification_status": "qualified",
            "qualification_checklist": {
                "name": "Sarah Chen",
                "company": "DataFlow Inc",
                "role": "VP of Sales",
                "use_case": "Pipeline automation and lead scoring for our growing sales team",
                "company_size": 120,
                "timeline": "2 months",
                "timeline_months": 2,
            },
            "conversation": [
                {"role": "user", "content": "Hi, I'm Sarah from DataFlow. We need a CRM that can handle AI-powered lead scoring.", "timestamp": (now - timedelta(hours=2)).isoformat()},
                {"role": "assistant", "content": "Hi Sarah! Great to meet you. NovaCRM's AI lead scoring is one of our most popular features — it automatically prioritizes your pipeline based on engagement signals. Could you tell me about your team size and what you're currently using?", "timestamp": (now - timedelta(hours=2, minutes=-1)).isoformat()},
                {"role": "user", "content": "I'm VP of Sales at DataFlow. We have about 120 people and our current CRM is getting too basic. We specifically need pipeline automation and smart lead scoring.", "timestamp": (now - timedelta(hours=1, minutes=50)).isoformat()},
                {"role": "assistant", "content": "Perfect fit! With 120 users, you'd be on our Enterprise plan which includes AI scoring, custom pipeline stages, and automated follow-up sequences. Many teams your size see a 40% improvement in lead response time. What's your timeline for making a switch?", "timestamp": (now - timedelta(hours=1, minutes=49)).isoformat()},
                {"role": "user", "content": "We need to be up and running within 2 months. Can we book a demo with your solutions team?", "timestamp": (now - timedelta(hours=1, minutes=40)).isoformat()},
                {"role": "assistant", "content": "Absolutely! With a 2-month timeline, we can have you fully migrated well within that window. I'm scheduling a demo with our enterprise solutions team right away. 🎉", "timestamp": (now - timedelta(hours=1, minutes=39)).isoformat()},
            ],
            "resources_served": [{"title": "Enterprise Features Guide", "source_file": "enterprise.pdf", "relevance_score": 95}],
            "updated_at": (now - timedelta(hours=1, minutes=39)).isoformat(),
        },

        # ─── QUALIFIED: Startup founder — all criteria met ───
        {
            "id": str(uuid.uuid4()),
            "org_id": org_id,
            "session_id": f"demo-{uuid.uuid4().hex[:8]}",
            "persona": "Startup founder",
            "intent_score": 95,
            "intent_state": "Decision-Ready",
            "signals": ["qual_status:qualified", "name:Raj Patel", "company:CloudSprint", "role:CEO & Founder", "use_case:Sales tracking from day one", "company_size:18", "timeline_months:1"],
            "calendly_shown": True,
            "crm_filed": False,
            "qualification_status": "qualified",
            "qualification_checklist": {
                "name": "Raj Patel",
                "company": "CloudSprint",
                "role": "CEO & Founder",
                "use_case": "Sales tracking and pipeline management from day one as we scale",
                "company_size": 18,
                "timeline": "ASAP",
                "timeline_months": 1,
            },
            "conversation": [
                {"role": "user", "content": "Hey! I'm Raj, CEO of CloudSprint. We just closed our Series A and need a CRM ASAP.", "timestamp": (now - timedelta(minutes=45)).isoformat()},
                {"role": "assistant", "content": "Congratulations on the Series A, Raj! 🎉 NovaCRM is perfect for fast-growing startups. What's your current team size and what are you hoping to track?", "timestamp": (now - timedelta(minutes=44)).isoformat()},
                {"role": "user", "content": "We're 18 people, hiring fast. I need sales tracking and pipeline management from day one so nothing falls through the cracks.", "timestamp": (now - timedelta(minutes=35)).isoformat()},
                {"role": "assistant", "content": "Perfect — at 18 users you'd be on our Growth plan at $49/user/month. It includes everything you need: deal pipeline, AI lead scoring, email sequences, and activity tracking. Our guided onboarding takes about 20 minutes. Want to get started today?", "timestamp": (now - timedelta(minutes=34)).isoformat()},
                {"role": "user", "content": "Yes, this week! Can I talk to someone to speed up the onboarding?", "timestamp": (now - timedelta(minutes=25)).isoformat()},
                {"role": "assistant", "content": "Absolutely! I'll connect you with our onboarding team right now. They specialize in fast-track setups for growing teams like yours! 🚀", "timestamp": (now - timedelta(minutes=24)).isoformat()},
            ],
            "resources_served": [{"title": "Quick Start Guide", "source_file": "quickstart.pdf", "relevance_score": 92}],
            "updated_at": (now - timedelta(minutes=24)).isoformat(),
        },

        # ─── COLLECTING: Budget-conscious — has name + company, missing role & use_case ───
        {
            "id": str(uuid.uuid4()),
            "org_id": org_id,
            "session_id": f"demo-{uuid.uuid4().hex[:8]}",
            "persona": "Budget-conscious decision maker",
            "intent_score": 30,
            "intent_state": "Exploring",
            "signals": ["qual_status:collecting", "name:Mike Torres", "company:Greenleaf Solutions"],
            "calendly_shown": False,
            "crm_filed": False,
            "qualification_status": "collecting",
            "qualification_checklist": {
                "name": "Mike Torres",
                "company": "Greenleaf Solutions",
            },
            "conversation": [
                {"role": "user", "content": "Hi, I'm Mike from Greenleaf Solutions. How does NovaCRM compare to Pipedrive pricing?", "timestamp": (now - timedelta(hours=23)).isoformat()},
                {"role": "assistant", "content": "Hey Mike! Great question. NovaCRM's Growth plan is $49/user/month — it includes everything in Pipedrive's Advanced plan ($59/user) plus AI scoring and automated sequences. What kind of team are you building this for?", "timestamp": (now - timedelta(hours=23, minutes=-1)).isoformat()},
                {"role": "user", "content": "Hmm, the pricing looks decent. Let me check with my team first.", "timestamp": (now - timedelta(hours=22, minutes=45)).isoformat()},
                {"role": "assistant", "content": "Of course! When you're ready, I'd love to learn more about your specific needs so I can recommend the right plan. Feel free to come back anytime!", "timestamp": (now - timedelta(hours=22, minutes=44)).isoformat()},
            ],
            "resources_served": [{"title": "NovaCRM vs Competitors", "source_file": "comparison.pdf", "relevance_score": 88}],
            "updated_at": (now - timedelta(hours=22, minutes=44)).isoformat(),
        },

        # ─── COLLECTING: Casual explorer — only name provided ───
        {
            "id": str(uuid.uuid4()),
            "org_id": org_id,
            "session_id": f"demo-{uuid.uuid4().hex[:8]}",
            "persona": "Casual explorer",
            "intent_score": 30,
            "intent_state": "Exploring",
            "signals": ["qual_status:collecting", "name:Alex"],
            "calendly_shown": False,
            "crm_filed": False,
            "qualification_status": "collecting",
            "qualification_checklist": {
                "name": "Alex",
            },
            "conversation": [
                {"role": "user", "content": "What does NovaCRM do?", "timestamp": (now - timedelta(hours=1)).isoformat()},
                {"role": "assistant", "content": "NovaCRM is an AI-powered sales platform that helps teams manage their pipeline, score leads automatically, and close deals faster. What brings you here today — are you exploring CRM options for your team?", "timestamp": (now - timedelta(minutes=59)).isoformat()},
                {"role": "user", "content": "I'm Alex, just browsing. Might need something next quarter.", "timestamp": (now - timedelta(minutes=50)).isoformat()},
                {"role": "assistant", "content": "No worries, Alex! When you're ready, you can start with our free Starter plan — no credit card needed. What kind of company are you with? I can point you to the most relevant features.", "timestamp": (now - timedelta(minutes=49)).isoformat()},
            ],
            "resources_served": [],
            "updated_at": (now - timedelta(minutes=49)).isoformat(),
        },

        # ─── UNQUALIFIED: All fields filled but company_size < 10 threshold ───
        {
            "id": str(uuid.uuid4()),
            "org_id": org_id,
            "session_id": f"demo-{uuid.uuid4().hex[:8]}",
            "persona": "Implementation manager",
            "intent_score": 10,
            "intent_state": "Exploring",
            "signals": ["qual_status:unqualified", "name:Jenny Kim", "company:Kim Consulting", "role:Founder", "use_case:Client tracking", "company_size:3", "timeline_months:12"],
            "calendly_shown": False,
            "crm_filed": False,
            "qualification_status": "unqualified",
            "qualification_checklist": {
                "name": "Jenny Kim",
                "company": "Kim Consulting",
                "role": "Founder",
                "use_case": "Client tracking for my freelance consulting",
                "company_size": 3,
                "timeline": "maybe next year",
                "timeline_months": 12,
            },
            "conversation": [
                {"role": "user", "content": "Hi, I'm Jenny Kim, founder of Kim Consulting. I do freelance consulting and need to track my 3 clients better.", "timestamp": (now - timedelta(hours=20)).isoformat()},
                {"role": "assistant", "content": "Hi Jenny! Nice to meet you. For a solo consulting practice with 3 clients, NovaCRM might be more than you need right now. Can I ask about your timeline — when are you looking to get set up?", "timestamp": (now - timedelta(hours=20, minutes=-1)).isoformat()},
                {"role": "user", "content": "Not urgent, maybe next year. I'm just exploring. We're only 3 people including me.", "timestamp": (now - timedelta(hours=19, minutes=50)).isoformat()},
                {"role": "assistant", "content": "Got it! For a team of 3 with a relaxed timeline, I'd recommend checking out our free Starter tier or some of these resources that might help in the meantime.", "timestamp": (now - timedelta(hours=19, minutes=49)).isoformat()},
            ],
            "resources_served": [
                {"title": "NovaCRM Product Spec Sheet", "source_file": "product-spec.pdf", "relevance_score": 80},
                {"title": "Quick Start Tutorial", "source_file": "quickstart.pdf", "relevance_score": 75},
            ],
            "updated_at": (now - timedelta(hours=19, minutes=49)).isoformat(),
        },

        # ─── COLLECTING: Active conversation, getting close ───
        {
            "id": str(uuid.uuid4()),
            "org_id": org_id,
            "session_id": f"demo-{uuid.uuid4().hex[:8]}",
            "persona": "Technical evaluator",
            "intent_score": 30,
            "intent_state": "Exploring",
            "signals": ["qual_status:collecting", "name:David Nguyen", "company:Velocity Labs", "role:Head of Revenue Ops"],
            "calendly_shown": False,
            "crm_filed": False,
            "qualification_status": "collecting",
            "qualification_checklist": {
                "name": "David Nguyen",
                "company": "Velocity Labs",
                "role": "Head of Revenue Ops",
            },
            "conversation": [
                {"role": "user", "content": "Hey, I'm David, Head of Revenue Ops at Velocity Labs. Does NovaCRM have a REST API? We need to connect it to our internal tools.", "timestamp": (now - timedelta(hours=21)).isoformat()},
                {"role": "assistant", "content": "Hi David! Yes, we have a comprehensive REST API covering contacts, deals, activities, and webhooks. We also have pre-built connectors for Zapier and Make. What specific integrations are you looking for?", "timestamp": (now - timedelta(hours=21, minutes=-1)).isoformat()},
                {"role": "user", "content": "Our custom billing system and a Slack bot. Also curious about the pricing.", "timestamp": (now - timedelta(hours=20, minutes=50)).isoformat()},
                {"role": "assistant", "content": "Both are doable! We have a native Slack integration, and for billing you can use our webhook events to sync in real-time. What would you be using NovaCRM for primarily — and how large is your sales team? That'll help me recommend the right plan.", "timestamp": (now - timedelta(hours=20, minutes=49)).isoformat()},
            ],
            "resources_served": [{"title": "API Documentation", "source_file": "api-docs.pdf", "relevance_score": 95}],
            "updated_at": (now - timedelta(hours=20, minutes=49)).isoformat(),
        },
    ]

    for lead in leads:
        sb.table("leads").upsert(lead).execute()

    print(f"  ✓ {len(leads)} demo leads created:")
    for lead in leads:
        status = lead["qualification_status"]
        name = lead["qualification_checklist"].get("name", "Unknown")
        emoji = {"qualified": "🟢", "unqualified": "🔴", "collecting": "🟡"}[status]
        print(f"    {emoji} {name} — {status.capitalize()}")

    # ── 7. Seed intent/qualification history ──
    history_entries = []
    for lead in leads:
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
            pass

    print(f"  ✓ {len(history_entries)} intent history entries")

    print("\n✅ Demo seed complete!")
    print(f"   Login to dashboard at https://salesgen-dashboard.vercel.app")
    print(f"   Org slug: novacrm")
    print(f"\n   Lead summary:")
    print(f"   🟢 2 Qualified — Sarah Chen (DataFlow), Raj Patel (CloudSprint)")
    print(f"   🟡 3 Collecting — Mike Torres, Alex, David Nguyen")
    print(f"   🔴 1 Unqualified — Jenny Kim (too small, too late)")


if __name__ == "__main__":
    seed()
