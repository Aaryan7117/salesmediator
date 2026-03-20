import requests

# 1. Fill in your Frappe Cloud details here:
FRAPPE_URL = "https://salesgen.frappe.cloud"
EMAIL = "aaryanm7117@gmail.com"  # Your Frappe Cloud login email
PASSWORD = "Rn7117@123"  # Your Frappe Cloud password
def get_api_key():
    session = requests.Session()
    
    # Login to Frappe
    login_url = f"{FRAPPE_URL}/api/method/login"
    login_data = {
        "usr": EMAIL,
        "pwd": PASSWORD
    }
    
    print(f"Logging into {FRAPPE_URL}...")
    res = session.post(login_url, data=login_data)
    
    if res.status_code != 200:
        print(f"❌ Login failed: {res.text}")
        return
        
    print("✅ Login successful!")
    
    # Generate API Keys for the user
    keygen_url = f"{FRAPPE_URL}/api/method/frappe.core.doctype.user.user.generate_keys"
    res = session.post(keygen_url, data={"user": EMAIL})
    
    if res.status_code == 200:
        data = res.json().get("message", {})
        api_key = data.get("api_key")
        api_secret = data.get("api_secret")
        
        print("\n🎉 SUCCESS! Here is your Frappe CRM Token:")
        print("-" * 50)
        print(f"token {api_key}:{api_secret}")
        print("-" * 50)
        print("\nCopy the exact line above and paste it into the SalesGen mobile app!")
    else:
        print(f"❌ Failed to generate keys: {res.text}")

if __name__ == "__main__":
    get_api_key()
