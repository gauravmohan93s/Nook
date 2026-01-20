# Nook Final Flow (End-to-End)

This document describes the full flow: architecture, setup, testing, and
deployment. Keep it updated as production details evolve.

## System Flow

1) User submits a URL in the Nook UI.
2) Backend selects a source adapter (Medium, arXiv, PMC, or generic).
3) Adapter fetches content, cleans it, normalizes it, and proxies images.
4) Backend returns HTML + `source` + `license` to the UI.
5) Optional: summarize, TTS, and save to library.

## Supported Sources (Current)

- Medium (public-archive mirrors)
- arXiv (open-access)
- PubMed Central (open-access)
- Generic adapter (unknown license, minimal cleanup)
- OpenAlex (metadata, open-access where available)
- Semantic Scholar (metadata, open-access where available)

## Environment Variables

Backend (`Nook/backend/.env`):
- `API_BASE_URL` = backend base URL (used for image proxy links)
- `DATABASE_URL` = SQLAlchemy DB URL (SQLite local or Postgres in prod)
- `GEMINI_API_KEY` = optional, for summaries
- `CACHE_TTL_SECONDS` = cache TTL for content (seconds)
- `SEMANTIC_SCHOLAR_API_KEY` = Semantic Scholar API key

Frontend (`Nook/frontend/.env.local`):
- `NEXT_PUBLIC_API_URL` = backend base URL

## Local Setup

Backend:
```powershell
cd Nook\backend
copy .env.example .env
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8080
```

Frontend:
```powershell
cd Nook\frontend
$env:NEXT_PUBLIC_API_URL="http://localhost:8080"
npm run dev
```

## Supabase (Postgres) Setup

1) Create a Supabase project.
2) Copy the connection string from Project Settings -> Database.
3) Set `DATABASE_URL` in `Nook/backend/.env`, for example:
```
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/postgres?sslmode=require
```
4) Start the backend. Tables are created automatically by `init_db()`.

## Migrations (Alembic)

Initialize DB schema:
```powershell
cd Nook\backend
python -m alembic upgrade head
```

If you change models, generate a new migration:
```powershell
python -m alembic revision --autogenerate -m "add new fields"
python -m alembic upgrade head
```

If your SQLite DB already exists (tables created by `init_db()`), mark it as
already migrated:
```powershell
python -m alembic stamp head
```

## Testing (Manual)

Health:
```powershell
Invoke-RestMethod -Uri http://localhost:8080/api/health
```

Unlock:
```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:8080/api/unlock `
  -ContentType "application/json" `
  -Body '{"url":"https://arxiv.org/abs/1706.03762"}'
```

Summarize:
```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:8080/api/summarize `
  -ContentType "application/json" `
  -Body '{"url":"https://arxiv.org/abs/1706.03762"}'
```

UI checks:
- Unlock a Medium URL and verify images render.
- Unlock arXiv and PMC URLs; verify badges show correct `source`/`license`.
- Unlock an unknown URL; verify it uses `source=generic` and `license=unknown`.
- Unlock an OpenAlex URL (example: `https://openalex.org/W2741809807`) and verify metadata renders.
- Unlock a Semantic Scholar URL and verify metadata renders.

## Dev Scripts (Windows)

- Start backend: `Nook/start-backend.bat`
- Start frontend: `Nook/start-frontend.bat`

## Deployment Notes

- Set `API_BASE_URL` to the public backend URL.
- Set `NEXT_PUBLIC_API_URL` to the same backend URL.
- Keep DB and API keys in environment variables (not in repo).

## RLS Guidance (Supabase)

- Keep RLS disabled while only the backend connects to the database.
- Enable RLS if you ever query Supabase directly from the frontend.
