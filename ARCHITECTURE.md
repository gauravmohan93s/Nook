# Nook Architecture (Adapter-Based)

This document defines the adapter-based content pipeline and data model. Keep it
updated as sources and features evolve.

## Core Flow

1) URL intake
2) Source detection
3) Adapter fetch (raw HTML/PDF/metadata)
4) Clean + normalize to common schema
5) Sanitize HTML + apply security checks
6) Cache + return to client

## Adapter Interface (Conceptual)

Each adapter should implement:

- `can_handle(url) -> bool`
- `fetch(url) -> RawContent` (HTML, PDF, metadata)
- `normalize(raw) -> NormalizedArticle`
- `license(raw) -> "open-access" | "public-archive" | "unknown"`

## Normalized Article Schema

- id: string (hash of url + source)
- title: string
- authors: string[]
- source: string (e.g., "medium", "arxiv", "pmc")
- license: string ("open-access", "public-archive", "unknown")
- url: string
- abstract: string
- content_html: string
- references: string[]
- figures: string[]
- published_at: string (ISO)

## Data Storage

- Cache normalized content by URL + source.
- Cache summaries by URL + model + prompt hash.
- Store user actions: saves, summaries, TTS usage.

## API Outputs

`/api/unlock` should return:

- success
- html
- source
- license
- remaining_reads

## Source Detection Strategy

Priority order:

1) Explicit URL pattern match (domain rules).
2) Adapter `can_handle` fallback.
3) Unknown -> metadata-only response.

## Supported Sources (Current)

- Medium (public-archive mirrors)
- arXiv (open-access)
- PubMed Central (open-access)
- OpenAlex (metadata, open-access where available)
- Semantic Scholar (metadata, open-access where available)

## Compliance Guardrails

- If license == "unknown", allow content but label it clearly.
- Never market paywall bypass as a primary feature.
- Block unsafe/private network URLs at intake.
- Sanitize HTML before caching/serving to prevent XSS.

## Environment

- `API_BASE_URL`: Base URL for the backend (used for image proxy URLs).
- `DATABASE_URL`: SQLAlchemy database URL (SQLite local or Postgres in prod).
- `CACHE_TTL_SECONDS`: Cache TTL for fetched content (seconds).
- `SEMANTIC_SCHOLAR_API_KEY`: API key for Semantic Scholar.
- `ALLOWED_ORIGINS`: Comma-separated list of frontend URLs for CORS.
- `ALLOW_PRIVATE_NETWORK`: Allow private IP URL fetches (dev only).
- `MAX_IMAGE_BYTES`: Safety limit for proxy images.
- `LOG_LEVEL`, `LOG_FILE`, `LOG_MAX_BYTES`, `LOG_BACKUP_COUNT`: Logging controls.
