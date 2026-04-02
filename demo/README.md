# SalesGen — Full Demo Walkthrough

This folder contains everything needed to test and showcase the **full end-to-end SalesGen workflow** from signup to live AI chat.

---

## 🚀 Quick Start (3 Steps)

### Step 1 — Start the backend
```bash
cd backend
uvicorn main:app --reload --port 8000
```

### Step 2 — Import the Postman collection
Open Postman → Import → select `SalesGen.postman_collection.json`  
Or use the `curl_commands.sh` file in this folder directly.

### Step 3 — Run requests in order
Follow the numbered sequence below. Each step builds on the last.

---

## 🔁 Full Demo Sequence

| # | Action | File/Command |
|---|---|---|
| 1 | Sign up as a new org admin | `POST /auth/signup` |
| 2 | Log in + get JWT token | `POST /auth/login` |
| 3 | Upload demo Knowledge Base | `POST /kb/upload` (use `demo_kb.csv`) |
| 4 | Add Calendly integration | `PUT /integrations` |
| 5 | Chat as a buyer (low intent) | `POST /chat/salesgen-demo` |
| 6 | Chat as a buyer (high intent) | `POST /chat/salesgen-demo` |
| 7 | Check lead was created | `GET /leads` |
| 8 | View full lead + conversation | `GET /leads/{id}` |
| 9 | View analytics | `GET /analytics` |

---

## 📌 Notes
- Replace `YOUR_JWT_TOKEN` in each request with the token returned from login.
- Replace `LEAD_ID` with the actual lead `id` returned from the leads list.
- The backend must be running at `http://localhost:8000`.
- See `curl_commands.sh` for ready-to-run terminal commands.
