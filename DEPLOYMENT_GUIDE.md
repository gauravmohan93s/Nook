# Nook Deployment Guide (Razorpay Edition)

This guide walks you through deploying Nook (Frontend + Backend) with **Razorpay** as the payment gateway for India.

## Phase 1: Accounts & Credentials

1.  **Google Cloud Platform (Auth):**
    *   Create a new Project.
    *   Go to "APIs & Services" > "Credentials".
    *   Create "OAuth Client ID" (Web Application).
    *   **Authorized Origins:** `http://localhost:3000` (Dev), `https://your-frontend.vercel.app` (Prod).
    *   **Authorized Redirect URIs:** `http://localhost:3000/api/auth/callback/google` (Dev), `https://your-frontend.vercel.app/api/auth/callback/google` (Prod).
    *   Copy `Client ID` and `Client Secret`.

2.  **Razorpay (Payments):**
    *   Sign up at [Razorpay Dashboard](https://dashboard.razorpay.com/).
    *   Go to Settings > API Keys.
    *   Generate "Test Key".
    *   Copy `Key ID` and `Key Secret`.

3.  **Google AI Studio (Summaries):**
    *   Get a free API Key for Gemini Pro/Flash.

4.  **Semantic Scholar (Research):**
    *   Request a free API key (optional, limits apply without it).

---

## Phase 2: Backend Deployment (Render.com)

**Why Render?** It supports Python natively and offers a free tier.

1.  **Prepare Repo:** Push your latest code to GitHub.
2.  **Create Service:**
    *   New "Web Service".
    *   Connect your GitHub repo.
    *   **Root Directory:** `Nook/backend`
    *   **Build Command:** `pip install -r requirements.txt`
    *   **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
3.  **Environment Variables:**
    *   Add all variables from `Nook/backend/.env.example`.
    *   **DATABASE_URL:** For production, use the "Internal Database URL" from a Render PostgreSQL database (Create one in Dashboard > New > PostgreSQL).
    *   **API_BASE_URL:** The URL Render assigns you (e.g., `https://nook-backend.onrender.com`).
4.  **Deploy:** Click "Create Web Service".

---

## Phase 3: Frontend Deployment (Vercel)

1.  **Import Project:**
    *   Go to Vercel Dashboard > "Add New..." > Project.
    *   Import your GitHub repo.
2.  **Configure Project:**
    *   **Framework Preset:** Next.js
    *   **Root Directory:** `Nook/frontend` (Click Edit next to Root Directory).
3.  **Environment Variables:**
    *   `NEXT_PUBLIC_API_URL`: Your Render Backend URL (e.g., `https://nook-backend.onrender.com`).
    *   `AUTH_GOOGLE_ID`: Same as Backend.
    *   `AUTH_GOOGLE_SECRET`: Same as Backend.
    *   `AUTH_SECRET`: Generate a random string (e.g., `openssl rand -base64 32`).
4.  **Deploy:** Click "Deploy".

---

## Phase 4: Database Setup

Since the Render "Shell" is only available on paid plans, we will configure the app to run migrations automatically on startup.

1.  **Update Start Command:**
    *   Go to your Render Dashboard > Nook Backend > **Settings**.
    *   Find the **Start Command**.
    *   Change it to:
        ```bash
        python -m alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port $PORT
        ```
    *   Click **Save Changes**.

2.  **Verify:**
    *   Render will redeploy your service.
    *   Check the **Logs** tab. You should see migration logs (e.g., `Running upgrade...`) before the "Application startup complete" message.

---

## Phase 5: Verification

1.  Open your Vercel URL.
2.  Login with Google.
3.  Unlock an Article.
4.  Go to Pricing > Upgrade.
5.  Pay using Razorpay "Test Mode" (Use any dummy card).
6.  Verify you are upgraded to "Insider".
