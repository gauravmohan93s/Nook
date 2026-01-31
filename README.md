# Nook: Your Window to the Best Writing

**Mission:** To democratize access to world-class insights through intelligent curation and affordable micro-subscriptions.
**Tone:** Insightful, minimalist, and approachable. Nook acts as a "calm filter" in a noisy digital world.

---

## 📋 Project Status & Overview
**Version:** Beta 1.4 (Jan 2026)

Nook is a "Split Architecture" application (Render Backend + Vercel Frontend + Supabase DB) that acts as a universal reader. It unlocks, cleans, and enhances articles from various sources.

### Core Capabilities
*   **Unlock & Read:** Adapters for Medium (handling custom domains/mirrors), arXiv, PMC, OpenAlex, and Semantic Scholar.
*   **Intelligence:** AI Summaries (Gemini 2.0/1.5), Tiered Models, and Fallback providers (OpenRouter, Groq).
*   **Library:** Save, organize, and track reading history.
*   **Audio:** Browser-native TTS for listening to articles.
*   **Discovery:** Dynamic feed of curated reads and real-time AI/Tech news.

---

## 🏗 Architecture

### Adapter Pipeline
1.  **URL Intake:** Detects source (Medium, arXiv, etc.).
2.  **Fetch:** Adapter fetches raw content (HTML/PDF/Metadata).
3.  **Normalize:** Cleans and maps to a common schema (`title`, `content_html`, `authors`, etc.).
4.  **Sanitize:** HTML is sanitized (server-side) to prevent XSS.
5.  **Cache:** Content and summaries are cached in Postgres/Supabase to save resources.

### Tech Stack
*   **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS (deployed on Vercel).
*   **Backend:** Python FastAPI, SQLAlchemy, Alembic (deployed on Render).
*   **Database:** PostgreSQL (Supabase).
*   **AI:** Google Gemini (via `google-genai`), plus fallbacks.

### Key Directories
*   `backend/`: FastAPI application, models, and adapters.
*   `frontend/`: Next.js application, UI components.
*   `tests/`: Python tests for backend/AI logic.

---

## 🚀 Deployment Guide

### 1. Database (Supabase)
*   Create a project on Supabase.
*   Get the **Connection String** (Transaction mode, `?sslmode=require`).
*   Set this as `DATABASE_URL` in backend env vars.

### 2. Backend (Render)
*   **Type:** Web Service
*   **Runtime:** Python 3
*   **Build Command:** `pip install -r requirements.txt`
*   **Start Command:** `python -m alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port $PORT`
*   **Environment Variables:**
    *   `DATABASE_URL`: Supabase connection string.
    *   `GEMINI_API_KEY`: Google AI Studio key.
    *   `AUTH_GOOGLE_ID`: Google OAuth Client ID.
    *   `ALLOWED_ORIGINS`: Comma-separated list of frontend URLs.
    *   `SECRET_KEY`: Random string.
    *   `SENTRY_DSN`: Optional, for error tracking.

### 3. Frontend (Vercel)
*   **Type:** Next.js Project
*   **Root Directory:** `frontend`
*   **Environment Variables:**
    *   `NEXT_PUBLIC_API_URL`: URL of deployed Render backend.
    *   `AUTH_GOOGLE_ID`: Google OAuth Client ID.
    *   `AUTH_GOOGLE_SECRET`: Google OAuth Client Secret.
    *   `AUTH_TRUST_HOST`: Set to `true`.

### 4. Auth (Google Cloud)
*   Configure OAuth 2.0 Client.
*   Add Vercel domain (`https://your-app.vercel.app`) to **Authorized Origins**.
*   Add callback URL (`https://your-app.vercel.app/api/auth/callback/google`) to **Authorized Redirect URIs**.

---

## 💻 Development Guide

### Git Workflow
*   **`main`**: Production-ready code (Protected). Deploys automatically.
*   **`development`**: Integration branch.
*   **Feature Branches**: Create `feat/name` from `development`, merge back via PR.

### Local Setup

**Backend:**
```bash
cd backend
pip install -r requirements.txt
python -m alembic upgrade head
uvicorn main:app --reload --port 8080
# Or use start-backend.bat (Windows)
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
# Or use start-frontend.bat (Windows)
```

**Env Setup:**
*   Backend: Copy `.env.example` to `.env` and fill in keys.
*   Frontend: Copy `.env.local.example` to `.env.local` and set `NEXT_PUBLIC_API_URL=http://localhost:8080`.

---

## 🧪 Testing & Verification

### Manual Checks
*   **Health Check:** `GET /api/health` should return `{"status":"ok","db":"ok"}`.
*   **Unlock Flow:** `POST /api/unlock` with a URL (e.g., Medium article) should return content.
*   **Summarize:** `POST /api/summarize` should return text summary.

### Automated Tests
*   Run `pytest` in `tests/` folder.

---

## 🗺 Roadmap

### Current Priorities
*   [x] Fix Medium Image Proxying (Weserv).
*   [x] 3-Tier Pricing & Model Routing.
*   [x] Observability (Sentry + Prometheus).
*   [ ] "Chat with Article" (RAG).
*   [ ] Metrics Dashboards.

### Future Features
*   **Cross-Article Synthesis:** Compare multiple articles.
*   **Podcast Generation:** Two-person audio dialogue.
*   **Mobile App:** PWA or Native.

---

## 📈 Marketing & Growth Strategy
To transition from a tool to a "Hype Product", we are implementing:

1.  **Email Marketing (Resend):**
    *   **Welcome Sequence:** Immediate "Inner Circle" welcome email upon signup (Implemented).
    *   **Weekly Digest:** "Best of Nook" curated reads to drive retention.
2.  **Conversion Optimization:**
    *   **Landing Page:** Moving to high-conversion copy with "FOMO" elements (waiting lists, "join X readers").
    *   **Social Proof:** "Trending now" badges on articles.
3.  **Viral Loops:**
    *   **Share Summary:** One-click share of AI insights as branded images.

---

## 📜 Changelog / Progress
*   **Jan 2026:**
    *   **Architecture:** Unified Deployment (render.yaml), Custom Domain Support (Freedium), Native Browser TTS.
    *   **Frontend:** Dynamic Discover Page, Build Fixes (`--legacy-peer-deps`), Auth Hardening (`AUTH_TRUST_HOST`).
    *   **Backend:** Centralized API URL logic, Sentry/Prometheus integration.