# Nook Roadmap (Living Doc)

This document keeps Nook aligned on the pivot to a legally defensible "reading +
research workspace" while retaining Medium support as a source adapter. Update
this file regularly with decisions, progress, and changes.

## Product Direction

- Positioning: Unified reader for open web + research with premium tools.
- Medium: Supported as one adapter, not the headline. Emphasize compliance and
  open-access sources where possible.
- Revenue: Paid value comes from summaries, audio, library, export, and workflow
  features, not paywall bypass.

## Goals (90 Days)

- Ship adapter-based content pipeline with Medium + 2 open-access sources.
- Launch usage-based tiers with server-side enforcement.
- Improve retention via library, digest, and reading continuity.

## Non-Goals

- Building or promoting paywall-bypass as a primary value proposition.
- Supporting broad scraping of non-open-access publications without licensing.

## Milestones and Tracking

Use the checklist to track status. Move items to Done when shipped.

### Phase 1: Foundation (Weeks 1-3)

- [ ] Design adapter interface: fetch -> clean -> normalize.
- [ ] Move Medium logic into adapter.
- [ ] Add "source" and "license" fields in article response.
- [ ] Implement content normalization schema (title, author, text, images, refs).
- [ ] Add cache layer for parsed content (DB + TTL).

### Phase 2: Monetization + Reliability (Weeks 4-6)

- [ ] Add real billing and entitlements.
- [ ] Enforce usage limits server-side (summaries, TTS, saved items).
- [ ] Implement per-user usage metering.
- [ ] Improve HTML sanitization and XSS defense in reader output.

### Phase 3: Expansion (Weeks 7-10)

- [ ] Add arXiv adapter (metadata + PDF parsing).
- [ ] Add PubMed Central adapter (full text, OA).
- [ ] Add Semantic Scholar or OpenAlex adapter (metadata + OA links).
- [ ] Add citation export (BibTeX/RIS).

### Phase 4: Retention (Weeks 11-12)

- [ ] Weekly digest (topics + saved + trending).
- [ ] "Continue reading/listening" across sessions.
- [ ] Library enhancements: tags, notes, highlights.

## Source Adapter Plan

Each adapter should output the normalized article schema:

- id (string)
- title (string)
- authors (string[])
- source (string)
- license (string or "unknown")
- url (string)
- abstract (string)
- content_html (string)
- references (string[])
- figures (string[])
- published_at (string)

Notes:
- Keep Medium as an adapter but do not market it as the core promise.
- If license is unknown, limit to metadata + abstract.

## Monetization Design

### Free Tier (Seeker)
- Limited summaries per day.
- Limited TTS minutes per day.
- Limited saved items in library.

### Paid Tier (Insider)
- Unlimited summaries.
- Unlimited TTS.
- Full library + tags + highlights.
- Citation export.

### Patron
- Early access to new sources and tools.
- Priority support.

## KPIs

- Activation: % of users who unlock 1+ article within 1 day.
- Retention: D7 and D30 returning reader rate.
- Conversion: Free -> paid.
- Cost per summary and TTS minute.

## Services and Setup (Mostly Free)

Keep this list aligned with the chosen stack. Prefer free tiers for dev/prod.

- Frontend hosting: Vercel (free).
- Backend hosting: Render or Railway (free tier).
- Database: Supabase Postgres (free tier) or local SQLite for dev.
- Auth: NextAuth + Google OAuth (free).
- Summaries: Gemini free tier, cache results to reduce cost.
- TTS: gTTS for MVP; upgrade later if needed.
- OA sources: arXiv, PubMed Central, OpenAlex, Semantic Scholar (all free).
- License checks: Unpaywall (free).
- Search (optional): Meilisearch self-hosted or Typesense free tier.
- Email digests: Resend free tier or Postmark dev tier.
- Analytics: PostHog free tier or self-hosted Plausible.

## Testing

Backend (local):
- `cd Nook/backend`
- `python -m uvicorn main:app --reload --port 8080`

Frontend (local):
- `cd Nook/frontend`
- `NEXT_PUBLIC_API_URL=http://localhost:8080 npm run dev`

Smoke tests:
- Unlock a Medium URL and verify images render.
- Unlock an arXiv URL and verify badges show `source=arxiv` and `license=open-access`.
- Unlock a PMC URL and verify badges show `source=pmc` and `license=open-access`.
- Unlock an unknown URL and verify `source=generic` and `license=unknown`.
- Unlock an OpenAlex URL (example: `https://openalex.org/W2741809807`).
- Unlock a Semantic Scholar URL.

## SQLite + Alembic Notes

- If you already ran the app before Alembic, tables may exist from `init_db()`.
- In that case, run `python -m alembic stamp head` once to mark the DB as migrated.
- Use `python -m alembic upgrade head` for future migrations.

## Risks and Mitigations

- Legal risk: enforce license checks; avoid non-OA sources.
- Source reliability: add caching and fallbacks.
- Cost spikes: rate-limit and cache summaries/TTS.

## Decisions Log

- 2026-01-17: Pivot to OA + research workspace while keeping Medium adapter.
- 2026-01-19: Added adapter architecture and initial OA adapters (arXiv, PMC).
- 2026-01-19: Added OpenAlex adapter for metadata-based research access.
- 2026-01-19: Added Semantic Scholar adapter (API key required).
