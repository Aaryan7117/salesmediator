import requests
import json
import os

BASE_URL = "http://127.0.0.1:8000"

def seed_eduflow():
    print("🚀 Starting EduFlow Org Seeding...")
    
    # 1. Sign up EduFlow
    print("\n--- 1. SIGN UP ---")
    signup_data = {
        "email": "demo@eduflow.io",
        "password": "securepassword123",
        "org_name": "EduFlow",
        "full_name": "Demo Admin"
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
        "email": "demo@eduflow.io",
        "password": "securepassword123"
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

    # 3. Configure Integrations
    print("\n--- 3. CONFIGURE INTEGRATIONS ---")
    integrations_data = {
        "calendly_link": "https://calendly.com/eduflow-demo/15min",
        "frappe_url": "https://your-crm.frappe.cloud",
        "frappe_token": "token demo_key:demo_secret",
        "github_repo": "Aaryan7117/salesmediator",
        "github_pat": "github_pat_demo"
    }
    r = requests.put(f"{BASE_URL}/integrations/", headers=headers, json=integrations_data)
    if r.status_code == 200:
        print("✅ Integrations configured (Calendly, Frappe, GitHub).")
    else:
        print(f"⚠️ Integrations: {r.status_code} - {r.text}")

    # 4. Upload KB
    print("\n--- 4. UPLOAD KNOWLEDGE BASE ---")
    demo_file_path = "demo/demo_kb.csv"
    if os.path.exists(demo_file_path):
        with open(demo_file_path, "rb") as f:
            files = {"file": ("demo_kb.csv", f, "text/csv")}
            r = requests.post(f"{BASE_URL}/kb/upload", headers=headers, files=files)
            if r.status_code in [200, 201]:
                resp = r.json()
                chunks = resp.get("chunk_count", "?")
                print(f"✅ KB uploaded — {chunks} chunks created and vectorized.")
            else:
                print(f"❌ KB Upload failed: {r.status_code} - {r.text}")
    else:
        print(f"⚠️ KB file not found at {demo_file_path}. Skipping KB upload.")

    print("\n" + "="*50)
    print("🎉 EDUFLOW SEEDING COMPLETE!")
    print("="*50)
    print(f"Email:    demo@eduflow.io")
    print(f"Password: securepassword123")
    print(f"Org Slug: {org_slug}")
    print(f"\n⚠️  Make sure eduflow-demo.html has:")
    print(f"    const ORG_SLUG = '{org_slug}';")
    print("="*50)

if __name__ == "__main__":
    seed_eduflow()
