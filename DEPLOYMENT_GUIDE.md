# Nook Deployment Guide (Blueprint Edition)

This guide walks you through deploying Nook (Frontend + Backend + Database) using Render Blueprints.

## Phase 1: Accounts & Credentials

1.  **Google Cloud Platform (Auth):**
    *   **Authorized Origins:** `https://your-frontend.onrender.com`.
    *   **Authorized Redirect URIs:** `https://your-frontend.onrender.com/api/auth/callback/google`.

2.  **Razorpay (Payments):**
    *   Sign up at [Razorpay Dashboard](https://dashboard.razorpay.com/).
    *   **Transaction Fees:** Note that Razorpay charges ~2% + GST per transaction.

3.  **Supabase (Database):**
    *   Create a project and get your **Transaction** or **Session** connection string.
    *   Ensure `?sslmode=require` is appended to the URL.

---

## Phase 2: Unified Deployment (Render Blueprints)

We now use a `render.yaml` file to deploy everything in one go.

1.  **Connect Repo:**
    *   Go to Render Dashboard -> **Blueprints**.
    *   Connect `https://github.com/gauravmohan93s/Nook`.
2.  **Apply Blueprint:**
    *   Render will detect `render.yaml` and propose creating `nook-backend`, `nook-frontend`, and a temporary `nook-db`.
    *   Click **Apply**.
3.  **Configure Secrets (Critical):**
    *   Go to the **nook-backend** service -> Environment.
    *   Update `DATABASE_URL` with your **Supabase** string.
    *   Add: `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `GEMINI_API_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`.
    *   Go to the **nook-frontend** service -> Environment.
    *   Add: `AUTH_SECRET` (any random string), `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`.
    *   Ensure `AUTH_TRUST_HOST=true` is set (Blueprint adds this).

---

## Phase 3: Troubleshooting & Common Fixes

### 1. "Dangerous Site" / Phishing Warning
This is a false positive from Google Safe Browsing common on `.onrender.com`.
*   **Bypass:** Details -> Visit this unsafe site.
*   **Permanent Fix:** Verify your domain in [Google Search Console](https://search.google.com/search-console) and request a security review.
*   **Auth Fix:** Ensure `AUTH_TRUST_HOST=true` and `AUTH_URL` matches your Render frontend URL exactly.

### 2. Frontend Build Conflicts
If `npm install` fails due to peer dependency conflicts (Next.js vs Sentry):
*   **Fix:** The Blueprint now uses `npm install --legacy-peer-deps`.

### 3. Database Migration Failures
If `alembic upgrade head` fails with `psycopg2.errors.UndefinedObject: index ... does not exist`:
*   **Fix:** This usually happens when the migration tries to drop an index that isn't in your production DB. Check `backend/alembic/versions` and comment out the failing `op.drop_index` lines.

### 4. Custom Domains (Medium)
Links like `python.plainenglish.io` are handled via the **Freedium Prefix** strategy in `backend/main.py`.

---

## Phase 4: Vercel Fallback (Optional)
If you prefer Vercel for the Frontend:
1.  Deploy only the Backend on Render.
2.  Deploy Frontend on Vercel.
3.  Set `NEXT_PUBLIC_API_URL` on Vercel to your Render Backend URL.
4.  Update Google OAuth Redirect URIs to the Vercel URL.