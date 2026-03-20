# 🎙️ SalesMediator — 3-Minute Pitch Video Script

---

## 🕐 [0:00 – 0:25] Hook — The Problem

> *[Show website homepage of a generic B2B SaaS company with a live chat bubble]*

**"Every B2B company has the same problem."**

A potential customer lands on your website. They're curious. They have questions.
But your sales rep is asleep. Your chatbot gives three scripted options that don't help.
So the buyer leaves — and never comes back.

**B2B companies lose an estimated 70% of potential leads just because they couldn't get answers fast enough.**

Generic chatbots don't understand urgency. They don't adapt. And they definitely don't know your product.

---

## 🕐 [0:25 – 1:00] The Solution — What Is SalesMediator?

> *[Show the EduFlow demo HTML page with the chat widget open]*

**"We built SalesMediator."**

SalesMediator deploys a fully intelligent, product-aware AI sales consultant directly on any company's website — in minutes.

Not a scripted bot. A **real AI sales rep** that:
- Knows your entire product catalogue through a custom Knowledge Base
- Understands exactly how serious the buyer is in real-time
- And adapts how it speaks based on where the buyer is in their journey

---

## 🕐 [1:00 – 1:45] Under the Hood — Innovation & Tech

> *[Show a quick architecture flow diagram / code snippets]*

Here's what makes us different:

**1. Intent Scoring Engine**
Every message from the buyer is scored in real-time — 0 to 100 — based on signals like pricing questions, deadline mentions, competitor comparisons, and demo requests. The AI knows when to educate, when to differentiate, and when to close.

**2. RAG-Powered Knowledge Base**
Companies upload product documents — PDFs or CSVs. We embed them using sentence-transformers into ChromaDB. Every AI reply is grounded in actual company data — no hallucinations, no making things up.

**3. Persona Detection**
The LLM classifies the buyer type within the first 3 messages — Technical Evaluator, Business Buyer, Champion, etc. — and adapts tone accordingly.

**4. Auto-Integration Triggers**
When a buyer crosses the "Decision-Ready" threshold — score ≥ 76 — the platform automatically fires their data into Frappe CRM or creates a GitHub Issue. No manual data entry.

**Tech Stack:** Python FastAPI · Groq (Llama 3.1 70B) · ChromaDB · Supabase · React Native + Expo

---

## 🕐 [1:45 – 2:15] Live Demo

> *[Screen recording of the chat widget in action]*

Watch this — a buyer types:
*"Hi, we have about 50 sales reps and we need to decide before end of quarter"*

In real-time:
- Intent score jumps (+15 for team size, +25 for deadline = 40 points)
- State transitions: Exploring → Comparing
- AI responds with relevant product differentiation from our KB
- A Calendly scheduling prompt appears at the right moment

Meanwhile — on the mobile app — the admin sees this lead appear instantly. Intenets score, buyer persona, full conversation thread. One tap to assign to a rep.

---

## 🕐 [2:15 – 2:45] Market & Scale

> *[Show a visual of the target market]*

**Who is this for?**
Any B2B SaaS, agency, or product company that sells online and hasn't hired a 24/7 sales team — which is **most of them**.

The global conversational AI market is projected at **$32 billion by 2030**.

Our platform is **multi-tenant from day one** — one backend, infinite companies. Each org is fully isolated with their own KB, leads, team, and integrations.

**Monetization:**
- Freemium: 1 knowledge source, 100 chats/month
- Growth: Unlimited KB, CRM integrations, analytics
- Enterprise: Custom LLM fine-tuning, white-label widget, SLA

---

## 🕐 [2:45 – 3:00] Close

> *[Show team / GitHub repo]*

**"SalesMediator turns every B2B website into a 24/7 intelligent sales team."**

We've built the full stack — backend, AI pipeline, mobile app, and embeddable widget — in a single hackathon.

The code is on GitHub. The demo runs live. Build it fully — or don't move forward.

**We built it fully.**

*[End card: GitHub URL, Team Name]*

---
*Total estimated runtime: ~3 minutes at normal speaking pace.*
*Tip: Record in sections and cut together — the demo section works great as a screen recording.*
