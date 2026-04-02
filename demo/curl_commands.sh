#!/bin/bash
# ==============================================================================
# SalesGen — Demo Walkthrough curl Commands
# Copy and paste these into your terminal in order.
# Ensure the backend is running: `uvicorn main:app --reload --port 8000`
# ==============================================================================

# 1. Sign Up (Create a new organisation and admin user)
echo "--- 1. SIGN UP ---"
curl -X POST "http://localhost:8000/auth/signup" \
     -H "Content-Type: application/json" \
     -d '{
           "email": "demo@salesgen.ai",
           "password": "securepassword123",
           "org_name": "SalesGen Demo Org",
           "full_name": "Demo Admin"
         }'
echo -e "\n\n"

# 2. Log In (Get your JWT token - copy the access_token from the response)
echo "--- 2. LOG IN ---"
curl -X POST "http://localhost:8000/auth/login" \
     -H "Content-Type: application/json" \
     -d '{
           "email": "demo@salesgen.ai",
           "password": "securepassword123"
         }'
echo -e "\n\n"

# ---> IMPORTANT: Set your token as an environment variable for the next commands:
# > set TOKEN="ey..." (Windows) 
# > export TOKEN="ey..." (Mac/Linux)

# 3. Upload Knowledge Base (Seed the AI's memory with our demo_kb.csv)
echo "--- 3. UPLOAD KB ---"
curl -X POST "http://localhost:8000/kb/upload" \
     -H "Authorization: Bearer $TOKEN" \
     -F "file=@demo_kb.csv"
echo -e "\n\n"

# 4. Configure Integrations (Calendly, Frappe CRM, GitHub)
echo "--- 4. CONFIGURE INTEGRATIONS ---"
curl -X PUT "http://localhost:8000/integrations" \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
           "calendly_link": "https://calendly.com/your-sales-rep/15min",
           "frappe_url": "https://your-crm.frappe.cloud",
           "frappe_token": "token your_api_key:your_api_secret",
           "github_repo": "Aaryan7117/salesmediator",
           "github_pat": "github_pat_11A..."
         }'
echo -e "\n\n"

# 5. Chat - Message 1 (Exploring - Low Intent)
echo "--- 5. CHAT (Turn 1: Exploring) ---"
curl -X POST "http://localhost:8000/chat/salesgen-demo-org" \
     -H "Content-Type: application/json" \
     -d '{
           "message": "Hi, I am just exploring. What does SalesGen actually do?",
           "session_id": "demo-session-123"
         }'
echo -e "\n\n"

# 6. Chat - Message 2 (Comparing - Medium Intent)
echo "--- 6. CHAT (Turn 2: Comparing) ---"
curl -X POST "http://localhost:8000/chat/salesgen-demo-org" \
     -H "Content-Type: application/json" \
     -d '{
           "message": "How does it compare to a normal chatbot? And what is the pricing?",
           "session_id": "demo-session-123"
         }'
echo -e "\n\n"

# 7. Chat - Message 3 (Decision-Ready - High Intent)
echo "--- 7. CHAT (Turn 3: Decision-Ready) ---"
curl -X POST "http://localhost:8000/chat/salesgen-demo-org" \
     -H "Content-Type: application/json" \
     -d '{
           "message": "We have a team of 50 reps and we need to deploy this by Q3. Can we get a demo?",
           "session_id": "demo-session-123"
         }'
echo -e "\n\n"

# 8. View All Leads (Admin view)
echo "--- 8. VIEW LEADS ---"
curl -X GET "http://localhost:8000/leads" \
     -H "Authorization: Bearer $TOKEN"
echo -e "\n\n"

# 9. View Analytics (Admin view)
echo "--- 9. VIEW ANALYTICS ---"
curl -X GET "http://localhost:8000/analytics" \
     -H "Authorization: Bearer $TOKEN"
echo -e "\n"
