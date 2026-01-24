# Nook Development Guide

This guide outlines the git workflow and development practices for the Nook project.

## Git Workflow

We use a feature-branch workflow rooted in `development`.

1.  **Main Branch (`main`)**:
    *   **Protected**. Production-ready code only.
    *   Deploys automatically to Render (Backend) and Vercel (Frontend).
    *   Never push directly to `main`. Merge from `development` via Pull Request or manual merge after testing.

2.  **Development Branch (`development`)**:
    *   **Staging**. Integration branch for new features.
    *   Deploys to a staging environment (if configured) or used for local testing.
    *   Developers push features here first.

3.  **Feature Branches**:
    *   Create for each task: `git checkout -b feat/my-feature`
    *   Commit changes.
    *   Merge into `development` when ready.

### Standard Cycle

```bash
# 1. Start fresh
git checkout development
git pull origin development

# 2. Work on feature
git checkout -b feat/youtube-adapter
# ... coding ...
git add .
git commit -m "feat(backend): add youtube transcript support"

# 3. Merge to Development (Local Test)
git checkout development
git merge feat/youtube-adapter
# ... test locally ...
git push origin development

# 4. Release to Production
git checkout main
git merge development
git push origin main
```

## Setup & Running Locally

1.  **Backend**:
    *   `cd backend`
    *   `pip install -r requirements.txt`
    *   `python -m alembic upgrade head` (DB Migration)
    *   `uvicorn main:app --reload --port 8080`
    *   *Or run `start-backend.bat`*

2.  **Frontend**:
    *   `cd frontend`
    *   `npm install`
    *   `npm run dev`
    *   *Or run `start-frontend.bat`*

## Key Features & Architecture

### Adapters (Backend)
Located in `backend/main.py`. Extend `BaseAdapter`.
*   **Medium**: Handles Medium & mirrors.
*   **YouTube**: Fetches metadata (oEmbed) and transcripts.
*   **Annas**: Searches Libgen/Anna's mirrors for books (PDFs).
*   **Arxiv/PMC**: Scientific papers.

### Search Logic
*   **Book Search**: Uses OpenLibrary API for metadata, then resolves download links via `AnnasAdapter` (Libgen scraping) on-demand.
*   **Article Search**: Currently RSS-based (Discover feed).

### Frontend
*   **Reader**: `frontend/components/Reader.tsx`. Handles HTML articles and PDF iframes (`proxy_pdf`).
*   **Navigation**: `NavLinks.tsx` (Client) + `Navbar.tsx` (Server). Mobile responsive.
