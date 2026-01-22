# Nook Progress Log

**Last Updated:** 21 January 2026

## In Progress
- Add Sentry + metrics dashboards (Grafana/hosted)
- Fix frontend Tailwind resolution error in dev (module resolution/root path)

## Recently Completed
- Server-side HTML sanitization before cache/serve
- URL safety checks for unlock/summarize/save/proxy
- Shared HTTP client with timeouts/keep-alive
- Request ID logging with rotation
- DOM sanitization in the reader
- Removed local `.env` files from repo (rotate keys now)
- Metadata now flows to reader UI (backend `metadata` wired to frontend)
- Image proxying now strips scheme for Weserv compatibility
- Tiered Gemini model routing by subscription tier
- Gemini retry/fallback logic improved
- Added Sentry hooks (backend + frontend) and `/metrics` endpoint
- Added basic rate limiting for unlock/summarize
- Frontend visual refresh (typography + palette + landing, dashboard, reader polish)
- Listener fallback flow: AI → legacy → browser-native
- Summarize UI error handling improvements
- External summary provider integration (optional env-based fallback)
- Multi-provider summary fallback: Gemini → OpenRouter → Groq → Qubrid
- Added `/api/me` for account + usage info
- Reader listen fallback: AI → legacy → browser-native (with login token checks)
- Reworked landing, dashboard, reader, library, settings, discover UI with indigo palette + new layout
- Admin cache tools (list + flush URL)
- Freedium metadata + tags + inline image preservation

## Verification (22 January 2026)
- **Critical Fix:** Disabled `reactCompiler` in Next.js to resolve frontend build OOM/hangs.
- **Critical Fix:** Implemented streaming and size limits for `proxy_image` to prevent backend OOM on large images.
- **Critical Fix:** Added size limits (5MB) to HTML fetching for all adapters to prevent memory exhaustion from large pages.
- Backend syntax check: OK.

## Verification (21 January 2026)
- Backend `GET /api/health`: OK
- Backend `POST /api/unlock` on `freedium-mirror.cfd/...`: OK (title/author/thumbnail populated)
- Backend mirror content test: `ai-agents-complete-course-f226aa4550a1` returns 24 images (weserv proxied)
- Gemini API direct test: `gemini-2.0-flash` returns 429 (free tier limit 0); `gemini-2.5-flash` succeeds
- Backend `GET /metrics`: OK (Prometheus metrics returned)

## Current Issues (22 January 2026)
- Library page crashes because `loading` is undefined in the render path. (fixed)
- Reader metadata missing on `/read` route; save flow uses "Untitled/Unknown" as a result. (fixed)
- Summarize UI ignores non-200 responses; users see no feedback on 401/402/429. (fixed)
- Listen flow lacks AI TTS and has no graceful fallback sequence. (fixed)

## Next Up
- Remove committed secrets from git history and rotate all keys
- Add metrics dashboard (Grafana/hosted)
- Add Sentry DSNs in env and verify error events
- Add AI TTS provider integration (frontend + backend endpoints)
