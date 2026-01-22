# Nook Project Status & System Documentation

**Date:** 21 January 2026
**Version:** Beta 1.3 (In Progress)

This document details the current implementation of core workflows, business logic, and file handling for the Nook application. It serves as the source of truth for the current status and deployment.

---

## 1. Core Workflow: Unlock & Read

### Current Status (Working)
*   **Architecture**: Adapter Pattern (Medium, Arxiv, PMC, OpenAlex, Semantic Scholar).
*   **Image Handling**: **UPDATED.** Now uses `images.weserv.nl` as a CDN proxy to bypass Medium's CORs/hotlinking protection. Local proxy (`/api/proxy_image`) is deprecated/fallback.
*   **Metadata**: **UPDATED.** Backend now parses `h1`, `meta` tags, and fallbacks (e.g., "Title | by Author") for `title`/`author`. Thumbnail is extracted from og:image, a stored data-thumbnail, or the first image in the article.
*   **Caching**: Content is cached in `content_cache` table. Logic added to invalidate cache if it contains old/broken local proxy links.
*   **Security**: **UPDATED.** HTML is sanitized before caching/serving and URL validation blocks unsafe/private targets.
*   **Networking**: **UPDATED.** Shared HTTP client with timeouts + keep-alive for efficiency.
*   **Images**: **UPDATED.** Weserv URL now strips scheme before proxying to improve compatibility; images lazy-load.
*   **Mirror Parsing**: **UPDATED.** When a freedium mirror is detected, `.main-content` is preferred to preserve article images.

### Files
*   `backend/main.py`: `unlock_article`, `clean_html`, `extract_metadata`.

---

## 2. Intelligence Features (AI & TTS)

### AI Summary
*   **Provider**: **Google Gemini (google-genai SDK)**.
*   **Model**: `gemini-2.0-flash` (Fallback to `gemini-1.5-flash`).
*   **Status**: Working, but subject to Free Tier Rate Limits (15 RPM).
*   **Optimization**: **UPDATED.** Summaries are now cached in `content_cache.summary` to prevent re-generation and save quota. 
*   **Error Handling**: Returns user-friendly "AI is busy" message on 429 errors.
*   **Reliability**: **UPDATED.** Retry + fallback model support (`GEMINI_MODEL`, `GEMINI_MODEL_FALLBACK`).
*   **Tiered Models**: **UPDATED.** Tier-specific model selection via `GEMINI_MODELS_*` to preserve quality for higher tiers.
*   **Fallback Providers**: **UPDATED.** Optional providers in order: Gemini → OpenRouter → Groq → Qubrid (config via `SUMMARY_PROVIDER_ORDER` and provider env keys).
*   **Provider Models**: **UPDATED.** Each provider supports multiple fallback models via `OPENROUTER_MODELS`, `GROQ_MODELS`, `QUBRID_MODELS`.
*   **Qubrid API**: **UPDATED.** OpenAI-compatible endpoint `https://platform.qubrid.com/api/v1/qubridai/chat/completions` with model list configured by env.
*   **Usage Transparency**: **UPDATED.** `/api/summarize` now returns provider + model + remaining credits.

### Audio (TTS)
*   **Architecture**: **UPDATED.** Switched from Backend `gTTS` to **Browser Native `window.speechSynthesis`**.
*   **Reason**: Backend `gTTS` was slow/blocking and prone to network timeouts. Browser TTS is instant, free, and offline-capable.
*   **Status**: Working (Frontend `Reader.tsx`).
*   **Legacy Endpoint**: **UPDATED.** Backend `/api/speak` deprecated behind `ENABLE_LEGACY_TTS=false`.

---

## 3. Library & Dashboard

### Current Status
*   **Views**: Tile and List view toggles implemented.
*   **Cards**: Rich cards displaying Thumbnail, Title, Author, and Date.
*   **Actions**: 
    *   **Save**: **UPDATED.** Checks for duplicates by normalizing URL (stripping query params).
    *   **Delete**: Implemented.
*   **Navigation**: "Sign Out" moved to Navbar. Dashboard links to placeholder Discover/Settings pages.
*   **Security**: **UPDATED.** URL validation added to save flow.

---

## 4. Observability & Tracking

*   **Logging**: **UPDATED.** Rotating file logs with request IDs. JSON event log for request duration.
*   **Usage Tracking**: **UPDATED.** Usage logging now records even unlimited tiers for analytics.
*   **Monitoring**: **UPDATED.** Sentry support + Prometheus `/metrics` endpoint added (requires env DSN).
*   **Rate Limiting**: **UPDATED.** Basic per-minute rate limits for unlock and summarize.
*   **Account Endpoint**: **UPDATED.** `/api/me` provides tier and remaining daily usage counts.
*   **Admin Cache Tools**: **UPDATED.** `/api/admin/cache` list + `/api/admin/cache/flush` for URL-specific invalidation.

---

## 5. Known Issues & Mitigations

*   **AI Rate Limits**: 429 errors occur if traffic spikes. 
    *   *Mitigation*: Caching enabled. Future: Upgrade to paid Gemini tier or rotate keys.
*   **Gemini Model Quota**: `gemini-2.0-flash` may show limit 0 on free tier.
    *   *Mitigation*: Set `GEMINI_MODEL=gemini-2.5-flash` and configure tiered model lists.
*   **Image Loading**: Some obscure CDNs might still block Weserv. 
    *   *Status*: Weserv fixes 99% of Medium cases.
*   **Metadata Reliability**: Metadata extraction is heuristic-based.
    *   *Mitigation*: Fallback to "Unknown Author" if parsing fails.
*   **Secrets in Repo**: `.env` files contain secrets and must be rotated and removed from git history.

---

## 6. Deployment & Environment

### Environment Variables
**Backend:**
*   `DATABASE_URL`: Postgres Connection String (Supabase).
*   `GEMINI_API_KEY`: Google AI Studio Key.
*   `SEMANTIC_SCHOLAR_API_KEY`: For research papers.
*   `AUTH_GOOGLE_ID`: For JWT verification.
*   `STRIPE_SECRET_KEY` / `RAZORPAY_KEY_ID`: Payments.
*   `ALLOWED_ORIGINS`: Comma-separated list of frontend URLs.
*   `ALLOW_PRIVATE_NETWORK`: Allow private IP fetch (dev only).
*   `MAX_IMAGE_BYTES`: Image proxy safety limit.
*   `ENABLE_LEGACY_TTS`: Legacy gTTS endpoint toggle.
*   `LOG_LEVEL`, `LOG_FILE`, `LOG_MAX_BYTES`, `LOG_BACKUP_COUNT`: Logging controls.
*   `GEMINI_MODELS_SEEKER`, `GEMINI_MODELS_SCHOLAR`, `GEMINI_MODELS_INSIDER`: Tiered model lists (comma-separated).
*   `RATE_LIMIT_UNLOCK_PER_MINUTE`, `RATE_LIMIT_SUMMARIZE_PER_MINUTE`: Basic per-minute rate limits.
*   `SENTRY_DSN`, `SENTRY_TRACES_SAMPLE_RATE`, `SENTRY_PROFILES_SAMPLE_RATE`: Error monitoring.

**Frontend:**
*   `NEXT_PUBLIC_API_URL`: URL of deployed backend.
*   `AUTH_GOOGLE_ID`: Google OAuth Client ID.
*   `AUTH_GOOGLE_SECRET`: Google OAuth Client Secret.

---

## 7. Future Work

1.  **Chat with Article (RAG)**: Allow users to ask questions about the specific article context.
2.  **Cross-Article Synthesis**: Select multiple articles in Library and summarize common themes.
3.  **Podcast Generation**: Generate 2-person audio dialogue from article text.
4.  **Mobile App**: PWA or Native wrapper.
5.  **Observability**: Add Sentry + metrics dashboards.
6.  **Security Hardening**: Rate limits, CSP tuning, and SSRF allowlists.
