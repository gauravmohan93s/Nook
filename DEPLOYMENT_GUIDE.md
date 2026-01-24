# Nook Deployment Guide (Split Architecture)

This guide details the deployment of Nook using the optimal "Split Architecture":
*   **Database:** Supabase (Postgres)
*   **Backend:** Render (Python/FastAPI)
*   **Frontend:** Vercel (Next.js)

This setup avoids Render's "Dangerous Site" warnings for Google Auth and leverages Vercel's superior edge network for the frontend.

## Phase 1: Database (Supabase)

1.  **Create Project:** Go to [Supabase](https://supabase.com) and create a new project.
2.  **Get Credentials:**
    *   Go to **Project Settings** -> **Database**.
    *   Copy the **Connection String** (use the "Transaction" mode if available, or "Session" mode).
    *   Ensure `?sslmode=require` is at the end of the URL.
    *   Keep this safe; this is your `DATABASE_URL`.

## Phase 2: Backend (Render)

1.  **Create Web Service:**
    *   Go to [Render Dashboard](https://dashboard.render.com).
    *   Click **New +** -> **Web Service**.
    *   Connect your GitHub repository.
2.  **Configuration:**
    *   **Name:** `nook-backend`
    *   **Root Directory:** `backend`
    *   **Runtime:** Python 3
    *   **Build Command:** `pip install -r requirements.txt`
    *   **Start Command:** `python -m alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port $PORT`
3.  **Environment Variables:**
    *   `DATABASE_URL`: Your Supabase connection string.
    *   `GEMINI_API_KEY`: Your Google AI Studio key.
    *   `AUTH_GOOGLE_ID`: Your Google OAuth Client ID.
    *   `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`: For payments.
    *   `ALLOWED_ORIGINS`: Comma-separated list of frontend URLs (e.g., `https://your-app.vercel.app,http://localhost:3000`).
    *   `SECRET_KEY`: Generate a random string.
    *   `SENTRY_DSN` (Optional): For backend error tracking.

## Phase 3: Frontend (Vercel)

1.  **Import Project:**
    *   Go to [Vercel Dashboard](https://vercel.com).
    *   Click **Add New...** -> **Project**.
    *   Import your GitHub repository.
2.  **Configuration:**
    *   **Framework Preset:** Next.js
    *   **Root Directory:** `frontend` (Important: Click Edit to select the `frontend` folder).
3.  **Environment Variables:**
    *   `NEXT_PUBLIC_API_URL`: The URL of your deployed Render backend (e.g., `https://nook-backend.onrender.com`).
    *   `AUTH_GOOGLE_ID`: Your Google OAuth Client ID.
    *   `AUTH_GOOGLE_SECRET`: Your Google OAuth Client Secret.
    *   `AUTH_SECRET`: Generate a random string (run `openssl rand -base64 32`).
    *   `AUTH_TRUST_HOST`: `true` (Recommended for Vercel/NextAuth).
4.  **Deploy:** Click **Deploy**.

## Phase 4: Authentication Setup (Google Cloud)

To fix the "Dangerous Site" or "Auth Error" issues:

1.  Go to **Google Cloud Console** -> **APIs & Services** -> **Credentials**.
2.  Edit your OAuth 2.0 Client.
3.  **Authorized JavaScript Origins:**
    *   `https://your-app.vercel.app` (Your Production Frontend)
    *   `http://localhost:3000` (Local Development)
4.  **Authorized Redirect URIs:**
    *   `https://your-app.vercel.app/api/auth/callback/google`
    *   `http://localhost:3000/api/auth/callback/google`
5.  **Save.**

## Phase 5: Verification & Checks

### 1. Backend Health Check
*   Open your Render Backend URL in a browser: `https://nook-backend.onrender.com/api/health`.
*   **Expected:** `{"status":"ok","db":"ok"}`.
*   **If it fails:** Check Render logs for database connection errors.

### 2. Frontend Login
*   Open your Vercel URL.
*   Click **Sign In** and complete the Google Login flow.
*   **Expected:** Redirect back to Dashboard/Home as a logged-in user.
*   **If it fails:** Verify `AUTH_TRUST_HOST` is true in Vercel and Redirect URIs match in Google Cloud.

### 3. Unlock Test (The "Real" Test)
*   Try to unlock a Medium article URL.
*   **Success:** You see the article content.
*   **Verification:** Check Render logs (`Logs` tab).
    *   **Normal:** `INFO: ... Unlock success with medium`
    *   **Fallback:** `INFO: ... Unlock success with jina` (This means primary blocked, fallback worked).

### 4. Database Migrations
*   When Render starts, it runs `alembic upgrade head`.
*   Check the top of the logs for `Running upgrade...` to ensure your Supabase DB schemas are up to date.