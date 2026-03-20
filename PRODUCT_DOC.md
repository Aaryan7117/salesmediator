# SalesMediator — Product Documentation

## 1. Product Overview

**SalesMediator** is a multi-tenant, AI-powered B2B Sales Consultant platform.

**Problem it solves:**  
B2B companies lose leads when website visitors can't get fast, knowledgeable answers. Traditional chatbots are scripted and dumb. Human reps can't be online 24/7. SalesMediator fills this gap with an AI that knows your product, understands buyer intent, and converts interest into booked meetings.

---

## 2. System Architecture & Flow

```
BUYER (Website Visitor)
        │
        │  POST /chat/{org_slug}
        ▼
┌─────────────────────────────────────────────┐
│              FastAPI Backend                 │
│                                             │
│  Step 1: Resolve Organisation (by slug)     │
│  Step 2: Create / Fetch Lead Session        │
│  Step 3: Score Intent (regex signals 0-100) │
│  Step 4: Detect Buyer Persona (LLM, turn 1-3)│
│  Step 5: RAG KB Retrieval (ChromaDB)        │
│  Step 6: Generate AI Reply (Groq LLM)       │
│  Step 7: Calendly Suppression Gate          │
│  Step 8: Fire CRM / GitHub if score ≥ 76   │
│  Step 9: Persist Lead to Supabase           │
│  Step 10: Return structured JSON response   │
└─────────────────────────────────────────────┘
        │
        ├──────────────────► ChromaDB (Vector KB)
        ├──────────────────► Groq API (LLM)
        ├──────────────────► Supabase (DB + Auth)
        └──────────────────► Frappe CRM / GitHub Issues

MOBILE APP (Admin + Sales Rep)
        │
        │  JWT-authenticated API calls
        ▼
   Leads / KB / Team / Analytics / Integrations
```

---

## 3. Core Feature Modules

### 3.1 Intent Scoring Engine (`services/intent.py`)
- Regex-weighted keyword matching on each buyer message
- Signals tracked: Pricing probe (+18), Timeline mention (+25), Competitor comparison (+20), Demo interest (+15), Team size (+15), Integration query (+12)
- Score clamped to 0–100; maps to 3 states: **Exploring** (0–40), **Comparing** (41–75), **Decision-Ready** (76–100)
- Negative signals reduce score (e.g. "just browsing" = -10)

### 3.2 Knowledge Base (RAG) (`services/kb_ingest.py`, `services/kb_retrieval.py`)
- Accepts PDF and CSV uploads via `/kb/upload`
- Text is chunked (500 chars, 50-char overlap, sentence-boundary-aware)
- Chunks embedded using `sentence-transformers` (all-MiniLM-L6-v2)
- Stored in ChromaDB, namespaced per org (`org_{org_id}` collection)
- At chat time, buyer query is embedded and the top-1 most similar chunk is retrieved

### 3.3 LLM Reply Generation (`services/llm.py`)
- Uses Groq Cloud API — `llama-3.1-70b-versatile`
- System prompt includes: org name, buyer persona, intent state guidance, KB context
- Last 6 conversation turns included for memory
- Strict instruction: only answer from KB content; explicitly admit uncertainty

### 3.4 Persona Detection (`services/persona.py`)
- Called only on the first 1–3 user messages to classify the buyer type
- Types: Technical Evaluator, Business Buyer, Champion, Casual Explorer
- Informs AI tone: technical depth vs. business ROI framing

### 3.5 Integrations (`services/integrations.py`)
- **Calendly:** Link shown when `intent_score ≥ 70` and not yet shown (suppression gate prevents spamming)
- **Frappe CRM:** Lead data auto-filed when score crosses 76 for the first time
- **GitHub Issues:** Optionally creates an issue per high-intent lead for dev-team tracking

---

## 4. Database Schema (Supabase / PostgreSQL)

| Table | Description |
|---|---|
| `orgs` | Organisation registry — name, slug, owner |
| `team_members` | Users linked to orgs — role (admin/rep) |
| `leads` | Full lead data — session, conversation JSON, intent score, persona, signals |
| `integrations` | Per-org config — Calendly link, Frappe URL/token, GitHub repo/PAT |
| `kb_documents` | Metadata about uploaded KB files |

Full schema: see `backend/schema.sql`

---

## 5. API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/signup` | ❌ | Register new org + admin user |
| POST | `/auth/login` | ❌ | Login, returns JWT |
| POST | `/chat/{org_slug}` | ❌ | Main buyer chat (public) |
| GET | `/leads` | ✅ | List all leads for org |
| GET | `/leads/{id}` | ✅ | Full lead detail + conversation |
| POST | `/kb/upload` | ✅ | Upload KB file (PDF/CSV) |
| GET/PUT | `/integrations` | ✅ | Manage Calendly/Frappe/GitHub config |
| GET | `/analytics` | ✅ | Intent breakdown, lead funnel stats |
| GET | `/team` | ✅ | List team members |
| GET | `/health` | ❌ | Health check |

Full interactive docs: `http://localhost:8000/docs` (when backend is running)

---

## 6. Mobile App Screens

| Screen | Role | Description |
|---|---|---|
| Login / Signup | All | Auth screens, org registration |
| Dashboard Home | Admin | Overview stats |
| Leads List | Admin + Rep | All leads with intent scores and states |
| Lead Detail | Admin + Rep | Full conversation, signals, persona |
| Knowledge Base | Admin | Upload/view KB documents |
| Team | Admin | Add/remove team members |
| Integrations | Admin | Configure Calendly, Frappe, GitHub |

---

## 7. Running the Project

### Backend
```bash
cd backend
pip install -r requirements.txt
# Copy .env.example → .env and fill in values
uvicorn main:app --reload --port 8000
```

### Mobile
```bash
cd mobile
npm install
npx expo start
```

### Web Demo
Open `eduflow-demo.html` directly in any browser.

---

## 8. Environment Variables Required

| Variable | Source | Purpose |
|---|---|---|
| `SUPABASE_URL` | Supabase Dashboard → API | Database + Auth connection |
| `SUPABASE_SERVICE_KEY` | Supabase Dashboard → API | Server-side DB access |
| `GROQ_API_KEY` | console.groq.com | LLM inference |
| `CORS_ORIGINS` | Your config | Allowed frontend origins |

---

*© 2026 SalesMediator Team — Hackathon Submission*
