# SalesGen — AI Sales Agent as a Service

**Paste one `<script>` tag, get a 24/7 AI sales agent that scores buyer intent, adapts its pacing, and notifies you when leads are hot.**

## What is SalesGen?

SalesGen is a multi-tenant AI platform that any B2B company can embed on their website. It doesn't just chat — it **reasons** about buyer intent using a hybrid AI engine (regex + LLM), adapts its sales behavior through 5 graduated stages, and fires integrations only when the buyer is truly ready.

### How it's different from chatbots

| Traditional Chatbot | SalesGen |
|---|---|
| Rigid Q&A scripts | Adaptive conversational AI |
| No intent understanding | Hybrid regex + LLM intent scoring |
| Shows CTA immediately | Multi-threshold pacing (5 stages) |
| Forgets context after 3 turns | Rolling memory summaries |
| No contradiction handling | Detects conflicting signals, asks clarifying questions |
| Black box | Real-time reasoning dashboard |

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                  SALESGEN PLATFORM                    │
│                                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │  Admin    │  │  Mobile  │  │  Widget SDK      │   │
│  │  Dashboard│  │  App     │  │  <script> tag    │   │
│  │  (React)  │  │  (RN)   │  │  Any website     │   │
│  └─────┬─────┘  └────┬─────┘  └────────┬─────────┘   │
│        └──────────────┼─────────────────┘             │
│                       │                               │
│              ┌────────▼────────┐                      │
│              │  FastAPI Backend │                      │
│              │                  │                      │
│              │  Chat Pipeline   │ ← 13-step pipeline  │
│              │  • Regex intent  │ ← Hybrid scoring    │
│              │  • LLM analysis  │ ← Contradiction     │
│              │  • Memory       │ ← Rolling summaries  │
│              │  • Pacing       │ ← 5-stage adaptive   │
│              │  • KB retrieval │ ← ChromaDB vectors   │
│              │  • SSE stream   │ ← Real-time monitor  │
│              └──┬──────────┬──┘                       │
│           ┌─────▼───┐ ┌───▼────┐                     │
│           │Supabase │ │ChromaDB│                      │
│           │Postgres │ │Vectors │                      │
│           └─────────┘ └────────┘                      │
│                                                       │
│  Integrations: Calendly • Slack • Webhook (Zapier)   │
└──────────────────────────────────────────────────────┘
```

---

## Quick Start

### 1. Backend
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env  # Add your Groq + Supabase keys
uvicorn main:app --reload
```

### 2. Database (Supabase)
Run these SQL files in order in the Supabase SQL Editor:
```
backend/schema.sql
backend/schema_v2.sql
```

### 3. Admin Dashboard
```bash
cd web-dashboard
npm install
npm run dev
# → http://localhost:5173
```

### 4. Widget (embed on any site)
```html
<script src="http://your-api-url/widget/widget.js"
        data-org="your-org-slug"
        data-api="http://your-api-url"></script>
```

### 5. Demo (optional)
```bash
python demo/seed_demo.py    # Seed demo data
open demo/novacrm-demo.html # Open demo website
```

---

## Project Structure

```
salesgen/
├── backend/                    # FastAPI backend
│   ├── main.py                 # App entry, CORS, routers
│   ├── config.py               # Environment variables
│   ├── supabase_client.py      # Supabase connection
│   ├── schema.sql              # Core DB schema
│   ├── schema_v2.sql           # v2 tables (widget_config, intent_history)
│   ├── routes/
│   │   ├── auth.py             # Signup, login, invite codes
│   │   ├── chat.py             # Main AI chat pipeline (13 steps)
│   │   ├── leads.py            # Lead listing + detail
│   │   ├── kb.py               # Knowledge base upload + query
│   │   ├── live.py             # SSE streaming + human takeover
│   │   ├── analytics.py        # Dashboard stats + intent timeline
│   │   ├── integrations.py     # Calendly, Slack, webhook config
│   │   ├── widget_config.py    # Widget appearance settings
│   │   ├── team.py             # Team members + invite codes
│   │   └── session.py          # Session polling
│   ├── services/
│   │   ├── intent.py           # Regex-based intent scoring
│   │   ├── intent_llm.py       # LLM-based intent analysis (hybrid)
│   │   ├── memory.py           # Conversation rolling summaries
│   │   ├── pacing.py           # 5-stage adaptive pacing engine
│   │   ├── llm.py              # LLM response generation
│   │   ├── persona.py          # Buyer persona detection
│   │   ├── kb_retrieval.py     # ChromaDB KB query
│   │   └── integrations.py     # Calendly gate + external calls
│   └── models/
│       └── schemas.py          # Pydantic request/response models
│
├── web-dashboard/              # Vite + React + TypeScript admin panel
│   └── src/
│       ├── App.tsx             # Auth context + routing
│       ├── index.css           # Dark premium design system
│       ├── components/
│       │   ├── ParticleBackground.tsx   # Three.js particle network
│       │   └── DashboardLayout.tsx      # Glassmorphic sidebar
│       └── pages/
│           ├── Login.tsx       # Auth
│           ├── Signup.tsx      # Org creation
│           ├── Onboarding.tsx  # 3-step setup wizard
│           ├── Dashboard.tsx   # Stats + recent leads
│           ├── LiveMonitor.tsx # Real-time AI brain view + takeover
│           ├── Leads.tsx       # Filterable lead table
│           ├── LeadDetail.tsx  # Transcript + timeline
│           ├── KnowledgeBase.tsx # Drag-drop upload
│           ├── WidgetCustomizer.tsx # Live preview
│           ├── Integrations.tsx # Calendly, Slack, Webhook
│           └── Team.tsx        # Member management
│
├── widget/                     # Embeddable widget SDK
│   ├── widget.js               # Self-contained chat widget
│   └── README.md               # Integration guide
│
├── mobile/                     # React Native mobile app
│
└── demo/                       # Demo files
    ├── novacrm-demo.html       # Realistic demo website
    └── seed_demo.py            # Database seed script
```

---

## AI Brain — How It Works

### 1. Hybrid Intent Scoring
Every buyer message goes through two scoring layers:
- **Regex engine** (fast, free): Pattern matching for 9 signal categories
- **LLM engine** (smart, slow): Called only when regex is ambiguous (0-1 signals). Detects implicit signals like "actively_evaluating" or "budget_holder"

### 2. Contradiction Detection
When the LLM detects conflicting intent ("just browsing" + asks about pricing), it generates a natural clarifying question instead of making assumptions.

### 3. Conversation Memory
Every 4 turns, the system generates a compressed summary of the conversation. This means turn 20 still has context from turn 1, unlike most chatbots.

### 4. 5-Stage Adaptive Pacing
| Stage | Score Range | Agent Behavior |
|-------|------------|----------------|
| Educational | 0-25 | Ask questions, provide general info |
| Comparative | 26-50 | Offer comparisons, case studies |
| Proactive | 51-70 | Surface pricing, mention team availability |
| Conversion | 71-85 | Show Calendly, reference similar teams |
| Handoff | 86-100 | Push for human handoff, urgent notification |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI (Python) |
| Database | Supabase (PostgreSQL) |
| Vector Store | ChromaDB |
| LLM | Groq Cloud (Llama 3.1) |
| Embeddings | all-MiniLM-L6-v2 |
| Dashboard | Vite + React + TypeScript |
| 3D Graphics | Three.js |
| Widget | Vanilla JavaScript |
| Mobile | React Native + Expo |

---

## License

MIT
