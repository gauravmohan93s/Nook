# Nook Current Outline

**Date:** 21 January 2026

## Current State (Short)
- Backend: adapter pipeline, HTML sanitization, image proxy via Weserv, tiered Gemini models, rate limits, Sentry hooks, Prometheus `/metrics`.
- Frontend: Next.js App Router, Sentry hooks, DOM sanitization, refreshed typography/palette.
- Known blocker: Next dev resolving Tailwind from monorepo root instead of `frontend/`.

## Active Work
1) Fix frontend Tailwind resolution during `npm run dev`.
2) Add hosted dashboards (Grafana/Prometheus) and configure Sentry DSNs.
3) Verify UI image rendering for freedium mirror articles in-browser.

## Key Env Settings
- Backend: `GEMINI_MODEL`, `GEMINI_MODELS_*`, `SENTRY_DSN`, rate limits.
- Frontend: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SENTRY_DSN`.

## Verification Checklist
- `GET /api/health` OK
- `POST /api/unlock` OK (images + metadata)
- `GET /metrics` OK
- Gemini model fallback works (2.5-flash succeeds)

## Planned Features (Next)
- RAG "Chat with Article"
- Metrics dashboard and alerts
- Automated regression tests (API + UI)
