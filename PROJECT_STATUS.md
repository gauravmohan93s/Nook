# Nook Project Status & System Documentation

**Date:** 20 January 2026
**Version:** Release Candidate 1.0

This document details the current implementation of core workflows, business logic, and file handling for the Nook application. It serves as the source of truth for the current status and deployment.

---

## 1. User Authentication & Account Management

### Current Status (Production Ready)
*   **Frontend**: Uses **NextAuth.js (v5 Beta)** with Google OAuth provider.
    *   File: `frontend/auth.ts`
    *   **Mechanism**: Passes the Google `id_token` (JWT) to the client session.
*   **Backend Communication**: 
    *   **Method**: Frontend sends `Authorization: Bearer <token>` header.
    *   **Security**: Backend verifies the JWT signature using Google's public keys.
*   **Backend Logic**:
    *   File: `backend/main.py` -> `get_current_user()`
    *   **Auto-Registration**: If the verified email doesn't exist, a new account is created.

---

## 2. Content Unlocking & Reader Flow

### Current Status
*   **Architecture**: Adapter Pattern.
*   **Logic**:
    1.  User submits URL in `app/page.tsx`.
    2.  Frontend calls `POST /api/unlock` (Authenticated).
    3.  **Backend (`main.py`)**:
        *   **Limit Check**: Checks `usage_logs` count for "Seeker" tier (Limit: 3/day).
        *   **Adapter Selection**: Identifies source (Medium, Arxiv, PMC, OpenAlex).
        *   **Cache Check**: Checks `content_cache` table.
        *   **Fetch**: If not cached, Adapter fetches and cleans content.
        *   **Response**: Returns HTML + Source Metadata.
*   **Files**:
    *   `backend/main.py`: Route handlers.
    *   `backend/models.py`: Database Models.

---

## 3. Library & Saved Pages

### Current Status
*   **Logic**:
    *   **Saving**: Authenticated `POST /api/save`.
    *   **Viewing**: Authenticated `GET /api/library`.
*   **Storage**: Table `saved_articles` linked to `users`.

---

## 4. Subscription & Payments

### Current Status (Stripe Integrated)
*   **Tiers**:
    *   **Seeker**: Free, 3 daily unlocks.
    *   **Insider**: Paid, unlimited.
*   **Upgrade Flow**:
    1.  User clicks "Upgrade" on `/pricing`.
    2.  Frontend calls `POST /api/create-checkout-session`.
    3.  Backend creates Stripe Session and returns URL.
    4.  User pays on Stripe.
    5.  Stripe sends webhook to `POST /api/webhooks/stripe`.
    6.  Backend verifies signature and updates `user.tier` to 'insider'.

---

## 5. Smart Features (AI & TTS)

### Current Status
*   **Summaries**: Google Gemini API (`POST /api/summarize`).
*   **Text-to-Speech**: gTTS streaming (`GET /api/speak`).

---

## Deployment Checklist

### 1. Environment Variables
Ensure these are set in your production environment (Vercel/Render):

**Backend:**
*   `DATABASE_URL`: Postgres Connection String.
*   `GEMINI_API_KEY`: For AI.
*   `SEMANTIC_SCHOLAR_API_KEY`: For research papers.
*   `AUTH_GOOGLE_ID`: For JWT verification.
*   `STRIPE_SECRET_KEY`: For payment processing.
*   `STRIPE_WEBHOOK_SECRET`: For webhook verification.
*   `STRIPE_PRICE_ID`: The Stripe Price ID for the subscription.

**Frontend:**
*   `NEXT_PUBLIC_API_URL`: URL of your deployed backend.
*   `AUTH_GOOGLE_ID`: Google OAuth Client ID.
*   `AUTH_GOOGLE_SECRET`: Google OAuth Client Secret.
*   `AUTH_SECRET`: Random string for NextAuth encryption.

### 2. Database
*   Run `python -m alembic upgrade head` against your production database.

### 3. Stripe
*   Create a "Product" in Stripe Dashboard.
*   Get the `price_...` ID.
*   Configure the Webhook URL in Stripe to point to `https://your-backend.com/api/webhooks/stripe`.