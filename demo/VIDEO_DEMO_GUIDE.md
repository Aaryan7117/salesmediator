# SalesGen — Complete Video Demo Guide

> Step-by-step instructions to showcase **every feature** of SalesGen for the hackathon video.

---

## Prerequisites (One-Time Setup)

```bash
# Terminal 1 — Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2 — Seed Demo Data
cd ..
python demo/seed_eduflow.py
```

Wait for "🎉 EDUFLOW SEEDING COMPLETE!" before proceeding.

---

## Part 1: Customer-Facing Chat Widget (EduFlow Demo Site)

> Open `eduflow-demo.html` in your browser.

### 1.1 — Show the Marketing Website
- Scroll through the full EduFlow marketing site (hero, features, pricing, testimonials, etc.)
- Point out: *"This is a real company's website — our SalesGen AI chat is embedded here."*

### 1.2 — AI Chat Interaction (Exploring Stage)
Click the chat bubble (bottom-right), then send these messages **one at a time**:

| # | Message to Type | What It Demonstrates |
|---|----------------|---------------------|
| 1 | `Hi, what is EduFlow?` | AI greets warmly, answers from KB, stays educational |
| 2 | `What features do you offer?` | KB retrieval shows feature details from uploaded CSV |
| 3 | `Do you have a mobile app?` | Shows deeper KB search on specific topics |

> **Narrate:** "The AI is in the *Exploring* stage. It answers using our knowledge base, never hallucinating."

### 1.3 — AI Chat Interaction (Comparing Stage)
Continue in the **same chat session**:

| # | Message to Type | What It Demonstrates |
|---|----------------|---------------------|
| 4 | `How does EduFlow compare to LinkedIn Learning?` | Intent score rises, persona shifts |
| 5 | `What integrations do you support? We use Salesforce and Slack` | Technical evaluation signals detected |
| 6 | `What about security and compliance? We're in healthcare` | Compliance-specific KB content retrieved |

> **Narrate:** "Notice the intent has shifted to *Comparing*. The AI detects the buyer persona and adapts its tone."

### 1.4 — AI Chat Interaction (Decision-Ready Stage)
Continue with buying signals:

| # | Message to Type | What It Demonstrates |
|---|----------------|---------------------|
| 7 | `What's the pricing? We have about 150 employees` | Shows pricing from KB, budget gatekeeper signals |
| 8 | `Can we get a demo? I'd like to schedule a call with your sales team` | 🟢 **Calendly popup appears!** Intent hits Decision-Ready |
| 9 | `I'd like to start a free trial` | Final conversion message |

> **Narrate:** "The buyer said 'schedule a call' — the Calendly scheduling link appeared automatically! The lead was also pushed to Frappe CRM and a GitHub issue was created."

### 1.5 — Voice Input
- Click the **microphone icon** 🎙️ next to the text input
- Say something like "Tell me about pricing"
- Shows voice-to-text input feature

---

## Part 2: Admin Dashboard (React Native Mobile App)

> Open Expo app: `cd mobile && npx expo start --clear`

### 2.1 — Admin Login
- Enter credentials:
  - **Email:** `demo@eduflow.io`
  - **Password:** `securepassword123`

### 2.2 — Dashboard Overview
- Show the **Analytics** tab: charts showing lead count, intent distribution, conversion rates
- Point out real-time data from the chat sessions you just created

### 2.3 — Leads Tab
- Show the list of leads captured from the chat widget
- Click on a lead to see:
  - Session history (full conversation)
  - Intent score & state
  - Detected persona
  - Signals triggered
  - Resources served from KB

### 2.4 — Knowledge Base Tab
- Show the uploaded documents list
- Point out chunk count (the CSV was split into chunks for vector search)

### 2.5 — Integrations Tab
- Show configured integrations: Calendly, Frappe CRM, GitHub
- Point out the status indicators

### 2.6 — Team Management Tab
- Show the admin's profile
- **Invite a rep**: Enter an email → generates invite code
- Show the rep role management

---

## Part 3: Integration Proof Points

### 3.1 — Frappe CRM (Lead Pushed)

> **About Frappe:** Frappe CRM is an open-source CRM tool. In the hackathon demo, the integration works via REST API — when a buyer's intent score crosses 76%, SalesGen automatically creates a Lead in Frappe CRM.

**To show Frappe CRM working:**

**Option A — Free Frappe Cloud Trial (Recommended for video):**
1. Go to https://frappecloud.com and sign up for a free trial
2. Create a new site (takes ~2 minutes)
3. Note your site URL (e.g., `yoursite.frappe.cloud`)
4. Go to **Settings > API Access** and generate an API key + secret
5. In the SalesGen mobile app → Integrations tab, enter:
   - Frappe URL: `https://yoursite.frappe.cloud`
   - Frappe Token: `api_key:api_secret`
6. Now trigger a Decision-Ready chat (send buying signals in the widget)
7. Go to your Frappe CRM → Leads list → you should see the lead auto-created!

**Option B — Just show the API call in terminal:**
```bash
# After a Decision-Ready chat, check the backend logs — you'll see:
# "Frappe CRM lead created: ..." in the terminal
```

### 3.2 — GitHub Issues (Auto-Created)
1. Go to your GitHub repo settings → **Developer Settings > Personal Access Tokens > Fine-grained tokens**
2. Create a token with `repo` scope
3. In the SalesGen mobile app → Integrations tab, enter:
   - GitHub Repo: `your-username/your-repo-name`
   - GitHub PAT: `ghp_your_token_here`
4. Trigger a Decision-Ready chat → Go to your repo's **Issues** tab → see the auto-created issue!

### 3.3 — Calendly (Scheduling Widget)
- Already visible in the chat widget when intent hits Decision-Ready
- For the video: Use the demo link `https://calendly.com/your-link` or just show the CTA appearing

---

## Part 4: Technical Architecture (Quick Walkthrough)

> Show code briefly in the IDE to demonstrate technical depth:

1. **`backend/routes/chat.py`** — The 10-step AI pipeline (org resolution → intent scoring → persona detection → KB retrieval → LLM reply → integration triggers)
2. **`backend/services/intent.py`** — Regex-based intent scoring with signal weights
3. **`backend/services/llm.py`** — Groq Cloud + Llama 3.3 70B integration
4. **`backend/services/kb_ingest.py`** — PDF/CSV chunking + sentence-transformer embeddings
5. **`backend/services/kb_retrieval.py`** — ChromaDB vector similarity search

---

## Demo Conversation Script (Copy-Paste Ready)

Use these messages in order for the smoothest demo flow:

```
Message 1: Hi! Can you tell me about EduFlow?
Message 2: What are the main features?
Message 3: Do you have a mobile app for employees?
Message 4: How do you compare to LinkedIn Learning?
Message 5: We use Salesforce and Slack — do you integrate with those?
Message 6: We're in healthcare so compliance is critical. How do you handle that?
Message 7: What's the pricing? We have about 150 users
Message 8: This looks great. Can I schedule a demo with your sales team?
Message 9: I'd like to start a trial. How do I sign up?
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Chat says "having trouble" | Check `.env` for `GROQ_API_KEY` and `GROQ_MODEL=llama-3.3-70b-versatile` |
| Chat returns 404 | The org slug in `eduflow-demo.html` must match the DB. Run `python demo/seed_eduflow.py` to see the correct slug |
| KB returns no results | Re-run `python demo/seed_eduflow.py` to re-upload the enriched CSV |
| Backend won't start | Run from `backend/` folder: `cd backend && uvicorn main:app --reload --port 8000` |
| Frappe/GitHub integration not firing | Intent score must reach 76+. Send strong buying signals ("schedule call", "budget approved", "ready to buy") |
