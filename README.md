# 🤖 Salesgen — AI-Powered Sales Consultant Platform

> *Turning every B2B website into a 24/7 AI sales rep*

---

## 🧩 Project Overview

### The Problem
B2B companies lose hundreds of leads every week because visitors land on their website, can't get answers fast enough, and leave without ever talking to a human. Traditional chatbots give generic, scripted responses. Human sales reps can't work 24/7. There's a gap between intent and conversion — and most companies can't fill it.

### The Solution
**Salesgen** is a full-stack, multi-tenant AI Sales Consultant platform. Companies sign up, upload their product knowledge base, and instantly deploy a smart, context-aware AI sales assistant directly on their website — one that:
- Remembers the full conversation
- Knows their product inside and out (via vector embeddings)
- Scores buyer intent in real-time and adapts its tone
- Auto-files hot leads directly into their CRM (Frappe / GitHub Issues)
- Shows a Calendly scheduling widget when the buyer is ready to convert

Sales reps and admins monitor everything in real-time via a dedicated mobile app.

---

## ✨ Features & Functionalities

### 🧠 Intelligent Chat Pipeline (10-Step AI Engine)
Each customer message goes through a full pipeline:
1. **Organisation resolution** — multi-tenant, each company has its own isolated context
2. **Session management** — tracks the lead from first message to close
3. **Intent scoring** — regex-weighted keyword signals (timeline, pricing, demo interest, competitor comparison) accumulate a 0–100 buyer intent score
4. **Persona detection** — classifies the buyer (Technical Evaluator, Business Buyer, etc.) using Llama 3.1 (Groq) within the first 3 messages
5. **RAG-based KB retrieval** — uses `sentence-transformers` + ChromaDB to find the most relevant knowledge base snippet for the query
6. **LLM reply generation (Groq)** — generates a grounded, concise reply using the KB context, persona, and intent state
7. **Calendly suppression gate** — only shows scheduling link when intent score reaches a configurable threshold (never pushy prematurely)
8. **Integration triggers** — fires Frappe CRM or GitHub Issues automatically when buyer crosses the "Decision-Ready" threshold (score ≥ 76)
9. **Lead persistence** — stores full conversation, signals, intent score, persona in Supabase
10. **Structured API response** — reply, session ID, intent state, KB resource, Calendly prompt

### 📊 Admin Dashboard (Mobile App)
- View all incoming leads with live intent scores and states (Exploring → Comparing → Decision-Ready)
- Browse full lead conversation history
- Manage team members and their roles (Admin / Sales Rep)
- Upload and manage the Knowledge Base (KB) documents
- Configure integrations: Calendly link, Frappe CRM, GitHub Issues sync

### 📱 Sales Rep View (Mobile App)
- Real-time lead feed assigned to the rep
- Click through to full lead detail including conversation history
- View buyer persona, intent score, triggered signals

### 🔒 Authentication & Multi-Tenancy
- Supabase Auth (JWT) — signup/login with organisation slug creation
- Each org's leads, KB entries, integrations, and conversations are fully isolated by `org_id`
- Role-based access: `admin` sees everything; `rep` sees their assigned leads only

### 🌐 Embeddable Web Widget
- A single `<script>` tag (simulated in `eduflow-demo.html`) embeds the AI chat widget into any website
- Full UI: typing indicators, KB resource cards, Calendly scheduler card, voice input
- Completely stateless from the host site's perspective

---

## 🏗️ Architecture & Tech Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                    BUYER'S BROWSER                               │
│   eduflow-demo.html  ──► Embeddable Chat Widget (JS)            │
│                              │ POST /chat/{org_slug}             │
└──────────────────────────────┼──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│                    FASTAPI BACKEND                               │
│                                                                  │
│  /auth  /chat  /leads  /kb  /team  /integrations  /analytics    │
│                                                                  │
│  ┌──────────────┐  ┌────────────────┐  ┌────────────────────┐  │
│  │ Intent Engine│  │  Groq (LLM)    │  │  ChromaDB (Vector) │  │
│  │  score 0-100 │  │ llama-3.1-70b  │  │  KB RAG Retrieval  │  │
│  └──────────────┘  └────────────────┘  └────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Supabase (Auth + PostgreSQL)                 │   │
│  │   orgs · leads · team_members · integrations · sessions  │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│               EXPO REACT NATIVE MOBILE APP                       │
│          Admin Dashboard ──── Sales Rep View                     │
└─────────────────────────────────────────────────────────────────┘
```

| Layer | Technology |
|---|---|
| **Backend** | Python 3.11, FastAPI, Uvicorn |
| **LLM** | Groq Cloud API — `llama-3.1-70b-versatile` |
| **Vector DB** | ChromaDB (persistent, local) |
| **Embeddings** | `sentence-transformers` — `all-MiniLM-L6-v2` |
| **Database & Auth** | Supabase (PostgreSQL + Auth) |
| **Mobile App** | React Native, Expo Router, TypeScript |
| **Web Demo** | Vanilla HTML + Tailwind CSS (CDN) |
| **CRM Integrations** | Frappe CRM, GitHub Issues |
| **Scheduling** | Calendly |

---

## 🗂️ Project Structure

```
salesgen/
│
├── backend/                    # FastAPI REST API
│   ├── main.py                 # App entry point, middleware, router registration
│   ├── config.py               # Environment variable loading (Pydantic Settings)
│   ├── supabase_client.py      # Supabase connection singleton
│   ├── schema.sql              # Full PostgreSQL schema (run in Supabase SQL Editor)
│   ├── requirements.txt        # Python dependencies
│   ├── .env.example            # Template for environment variables
│   │
│   ├── models/
│   │   └── schemas.py          # Pydantic request/response models
│   │
│   ├── routes/                 # One file per feature module
│   │   ├── auth.py             # Signup, login, team invite
│   │   ├── chat.py             # Main AI chat pipeline (10-step engine)
│   │   ├── kb.py               # Knowledge base upload & ingestion
│   │   ├── leads.py            # Lead listing, detail, assignment
│   │   ├── session.py          # Session management
│   │   ├── team.py             # Team member CRUD
│   │   ├── integrations.py     # Calendly, Frappe CRM, GitHub config
│   │   └── analytics.py        # Lead analytics & intent stats
│   │
│   └── services/               # Core business logic
│       ├── intent.py           # Regex-weighted intent scoring engine
│       ├── persona.py          # Buyer persona detection via LLM
│       ├── llm.py              # Groq LLM reply generation
│       ├── kb_ingest.py        # CSV → ChromaDB vector ingestion
│       ├── kb_retrieval.py     # Vector similarity search (RAG)
│       └── integrations.py     # Frappe CRM + GitHub Issues API clients
│
├── mobile/                     # Expo React Native app
│   ├── app/
│   │   ├── (auth)/             # Login + Signup screens
│   │   ├── (admin)/            # Admin dashboard screens
│   │   │   ├── index.tsx       # Dashboard home
│   │   │   ├── leads.tsx       # Lead list
│   │   │   ├── leads/[id].tsx  # Lead detail
│   │   │   ├── kb.tsx          # Knowledge base management
│   │   │   ├── team.tsx        # Team management
│   │   │   └── integrations.tsx# Integration settings
│   │   └── (rep)/              # Sales rep screens
│   │       ├── index.tsx       # Rep home
│   │       └── leads.tsx       # Assigned leads
│   ├── lib/
│   │   ├── api.ts              # Axios API client with JWT auth
│   │   └── supabase.ts         # Supabase client for mobile auth
│   └── store/
│       └── authStore.ts        # Zustand auth state management
│
├── eduflow-demo.html           # Standalone demo website with embedded chat widget
├── sample_kb_data.csv          # Sample KB data to seed ChromaDB
└── README.md
```

---

## 🚀 Setup & Installation Guide

### Prerequisites
- Python 3.10+
- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier works)
- A [Groq](https://groq.com) API key (free tier works)

---

### Step 1: Database Setup (Supabase)
1. Create a new project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** and run the full contents of `backend/schema.sql` to create all tables.
3. Copy your **Project URL** and **Service Role Key** from *Settings → API*.

---

### Step 2: Backend Setup

```bash
# Navigate into backend
cd backend

# Create a .env file from the template
copy .env.example .env
# (Edit .env with your actual keys — see .env.example for required fields)

# Install Python dependencies
pip install -r requirements.txt

# Start the backend server
uvicorn main:app --reload --port 8000
```

Once the server starts, the API docs are available at: `http://localhost:8000/docs`

---

### Step 3: Ingest Your Knowledge Base

To populate the AI's knowledge:
1. Add your product Q&A data in the format of `sample_kb_data.csv`.
2. Upload the CSV via the `/kb/upload` endpoint (or through the mobile app's KB screen).
3. The backend will embed and store each entry in ChromaDB under your organisation's namespace.

---

### Step 4: Mobile App Setup

```bash
# Navigate into mobile
cd mobile

# Install dependencies
npm install

# Start Expo dev server
npx expo start
```

Scan the QR code with the **Expo Go** app (iOS or Android) to launch the mobile experience.

---

### Step 5: Web Demo

Simply open `eduflow-demo.html` directly in any browser. No build step required.
The chat widget connects to the backend URL configured at the top of the file.

---

## 💡 Novelty of Our Solution

| Feature | Traditional Chatbots | SalesMediator |
|---|---|---|
| Knowledge grounding | Hardcoded scripts | RAG from dynamic vector KB |
| Buyer intelligence | None | Real-time intent scoring (0–100) + persona detection |
| Personalization | Generic | Adapts tone per intent state (Exploring / Comparing / Decision-Ready) |
| CRM integration | Manual | Auto-fires Frappe CRM + GitHub Issues at intent threshold |
| Scheduling | Never offered | Intelligently shown only when buyer is decision-ready |
| Multi-tenancy | Single tenant | Fully isolated per company via `org_id` + Supabase |
| Mobile monitoring | None | Real-time mobile dashboard for admins + reps |

**What makes this unique:**
- **No hallucinations** — the LLM is strictly grounded to KB content and explicitly told to admit uncertainty.
- **Intent-based suppression** — we don't spam the calendar link. It only shows when the buyer signals readiness.
- **Zero cold-start** — any company can upload a CSV and have a fully working AI sales rep in minutes.
- **Real-time lead telemetry** — admins see intent signals, personas, and conversation threads as they happen.

---

## 🔭 Future Ideas to Implement

- **Real-time push notifications** on mobile when a lead crosses the "Decision-Ready" threshold
- **Email & WhatsApp channel support** — same AI pipeline, multiple channels
- **A/B testing for personas** — test different AI tones and measure conversion rates
- **Voice-first chat** — integrate Whisper STT for fully voice-driven conversations
- **Analytics dashboard** — weekly intent trend reports, lead funnel visualizations
- **HubSpot / Salesforce CRM connectors** in addition to Frappe
- **Custom LLM fine-tuning** per organization for highly specialized verticals (legal, medical, finance)
- **Conversation handoff** — seamlessly transfer a live conversation to a human rep inside the mobile app

---

## 📸 Demo

Open `eduflow-demo.html` in a browser to interact with the live embedded AI chat widget.

**Live backend URL:** Configured in `.env` → `BACKEND_URL`

---

## 🔐 Environment Variables

See `backend/.env.example` for the full list of required variables. A copy with actual values has been submitted separately as required by the hackathon guidelines.

```
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
GROQ_API_KEY=your_groq_api_key
CORS_ORIGINS=*
```

---

## 📄 License

Built for hackathon submission. All rights reserved © 2026 SalesMediator Team.
