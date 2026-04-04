import requests
import json
import os

BASE_URL = "https://salesgen-api.onrender.com"

def seed_eduflow():
    print("🚀 Starting EduFlow Org Seeding...")
    
    # 1. Sign up EduFlow
    print("\n--- 1. SIGN UP ---")
    signup_data = {
        "email": "admin@eduflow.com",
        "password": "EduFlow2025!",
        "org_name": "EduFlow",
        "full_name": "EduFlow Admin"
    }
    r = requests.post(f"{BASE_URL}/auth/signup", json=signup_data)
    if r.status_code in [200, 201]:
        print("✅ Signup successful.")
    elif r.status_code == 400 and ("already" in r.text.lower()):
        print("✅ Account already registered. Continuing to login...")
    else:
        print(f"⚠️ Signup returned: {r.status_code} - {r.text}")
        print("   Attempting login anyway...")

    # 2. Login
    print("\n--- 2. LOG IN ---")
    login_data = {
        "email": "admin@eduflow.com",
        "password": "EduFlow2025!"
    }
    r = requests.post(f"{BASE_URL}/auth/login", json=login_data)
    if r.status_code != 200:
        print(f"❌ Login failed: {r.status_code} - {r.text}")
        return
    
    resp = r.json()
    token = resp.get("access_token")
    org_slug = resp.get("org_slug", "unknown")
    print(f"✅ Login successful. Org slug: {org_slug}")

    headers = {
        "Authorization": f"Bearer {token}"
    }

    # 3. Configure Widget
    print("\n--- 3. CONFIGURE WIDGET ---")
    widget_data = {
        "bot_name": "EduFlow Assistant",
        "greeting": "Hi! I'm EduFlow's AI assistant. I can help you explore our learning platform, answer pricing questions, or share customer stories. What brings you here today?",
        "brand_color": "#1D9E75",
        "position": "right"
    }
    r = requests.put(f"{BASE_URL}/widget-config/", headers=headers, json=widget_data)
    if r.status_code == 200:
        print("✅ Widget configured (EduFlow brand green).")
    else:
        print(f"⚠️ Widget config: {r.status_code} - {r.text}")

    # 4. Configure Integrations
    print("\n--- 4. CONFIGURE INTEGRATIONS ---")
    integrations_data = {
        "calendly_link": "https://calendly.com/eduflow-demo/15min",
    }
    r = requests.put(f"{BASE_URL}/integrations/", headers=headers, json=integrations_data)
    if r.status_code == 200:
        print("✅ Integrations configured (Calendly).")
    else:
        print(f"⚠️ Integrations: {r.status_code} - {r.text}")

    # 5. Upload KB
    print("\n--- 5. UPLOAD KNOWLEDGE BASE ---")
    demo_file_path = os.path.join(os.path.dirname(__file__), "demo_kb.csv")
    if not os.path.exists(demo_file_path):
        demo_file_path = "demo/demo_kb.csv"
    
    if os.path.exists(demo_file_path):
        with open(demo_file_path, "rb") as f:
            files = {"file": ("demo_kb.csv", f, "text/csv")}
            r = requests.post(f"{BASE_URL}/kb/upload", headers=headers, files=files)
            if r.status_code in [200, 201]:
                resp_data = r.json()
                chunks = resp_data.get("chunk_count", "?")
                print(f"✅ KB uploaded — {chunks} chunks created and vectorized.")
            else:
                print(f"⚠️ KB Upload: {r.status_code} - {r.text}")
    else:
        print(f"⚠️ KB file not found. Skipping KB upload.")

    # 6. Add Video & Resource Links
    print("\n--- 6. ADD VIDEO & RESOURCE LINKS ---")
    resources = [
        {
            "title": "EduFlow Platform Demo",
            "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "type": "video",
            "description": "Full walkthrough of EduFlow dashboard, learning paths, and analytics."
        },
        {
            "title": "Getting Started Tutorial",
            "url": "https://www.youtube.com/watch?v=Rx8Agl3VjnU",
            "type": "video",
            "description": "5-minute quick start guide: import team, assign courses, track progress."
        },
        {
            "title": "EduFlow Pricing Guide 2025",
            "url": "https://eduflow.com/pricing-guide-2025.pdf",
            "type": "spec",
            "description": "Detailed pricing breakdown: Starter ($299/mo), Growth ($799/mo), Enterprise (custom)."
        },
        {
            "title": "Integration Setup Guide",
            "url": "https://docs.eduflow.com/integrations",
            "type": "guide",
            "description": "Step-by-step guide for connecting Slack, BambooHR, Workday, and Salesforce."
        },
        {
            "title": "ROI Calculator & Case Studies",
            "url": "https://eduflow.com/roi-calculator",
            "type": "doc",
            "description": "Calculate your team's ROI. Includes 3 enterprise case studies."
        },
    ]
    
    for res in resources:
        r = requests.post(f"{BASE_URL}/kb-resources/", headers=headers, json=res)
        if r.status_code in [200, 201]:
            print(f"  ✅ Added: {res['title']} ({res['type']})")
        else:
            print(f"  ⚠️ {res['title']}: {r.status_code} - {r.text}")

    # 7. Set Qualification Criteria
    print("\n--- 7. SET QUALIFICATION CRITERIA ---")
    qual_data = {
        "criteria": [
            {"field": "company_size", "label": "Company Size"},
            {"field": "role", "label": "Role / Title"},
            {"field": "use_case", "label": "Use Case"},
            {"field": "timeline", "label": "Implementation Timeline"},
            {"field": "budget", "label": "Budget Range"},
        ],
        "qualifying_threshold": 3
    }
    r = requests.put(f"{BASE_URL}/qualification-settings/", headers=headers, json=qual_data)
    if r.status_code == 200:
        print("✅ Qualification criteria set (3/5 threshold).")
    else:
        print(f"⚠️ Qualification: {r.status_code} - {r.text}")

    # ── Summary ──
    print("\n" + "=" * 60)
    print("🎉 EDUFLOW SEEDING COMPLETE!")
    print("=" * 60)
    print(f"  Dashboard:  https://salesgen-dashboard.vercel.app")
    print(f"  Email:      admin@eduflow.com")
    print(f"  Password:   EduFlow2025!")
    print(f"  Org Slug:   {org_slug}")
    print(f"  Videos:     2 YouTube resources")
    print(f"  Resources:  {len(resources)} total KB resources")
    print(f"  Backend:    {BASE_URL}")
    print(f"\n  ⚠️  Make sure eduflow-demo.html has:")
    print(f"     const ORG_SLUG = '{org_slug}';")
    print("=" * 60)

if __name__ == "__main__":
    seed_eduflow()
