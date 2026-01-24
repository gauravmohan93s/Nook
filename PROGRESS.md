# Nook Progress Log

**Last Updated:** 23 January 2026

## Recently Completed
- **Unified Deployment**: Implemented `render.yaml` for full-stack Render Blueprint deployment.
- **Discover Page**: Created dynamic discover section with curated reads and RSS tech news.
- **Settings Refresh**: Redesigned settings with usage visualizers and account management.
- **Centralized API Logic**: Moved API URL handling to `frontend/utils/api.ts` to solve Render `host` vs `url` issues.
- **Custom Domain Support**: Fixed `MediumAdapter` to handle custom domains via Freedium prefix.
- **Frontend Build Fix**: Used `--legacy-peer-deps` to resolve Sentry/Next.js 16 version conflicts.
- **Migration Fix**: Patched migration 7ab94e5 to ignore non-existent index drops on production.
- **Type Safety**: Fixed `User` interface missing `created_at` and `Button` variant type errors.
- **Auth Hardening**: Added `AUTH_TRUST_HOST` to handle Render proxy headers.


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
