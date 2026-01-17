from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import httpx
import asyncio

app = FastAPI(title="Nook API", description="Your Window to the Best Writing")

class UnlockRequest(BaseModel):
    url: str

MIRRORS = [
    'freedium-mirror.cfd',
    'readmedium.com',
    'freedium.cfd',
    'scribe.rip'
]

async def check_mirror(client, original_url: str, mirror_host: str):
    try:
        from urllib.parse import urlparse, urlunparse
        parsed = urlparse(original_url)
        # Reconstruct URL with new netloc
        mirror_url = urlunparse(parsed._replace(netloc=mirror_host, scheme='https'))
        
        # We mimic a real browser to avoid blocking
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        
        response = await client.head(mirror_url, headers=headers, timeout=5.0, follow_redirects=True)
        if 200 <= response.status_code < 400:
            return mirror_url
    except Exception:
        return None
    return None

@app.post("/api/unlock")
async def unlock_article(request: UnlockRequest):
    async with httpx.AsyncClient() as client:
        tasks = [check_mirror(client, request.url, mirror) for mirror in MIRRORS]
        
        # We wait for the first successful result
        for task in asyncio.as_completed(tasks):
            result = await task
            if result:
                return {"success": True, "url": result, "summary": "AI Summary placeholder for Phase 1"}
                
    raise HTTPException(status_code=503, detail="No working mirrors found.")

@app.get("/")
def read_root():
    return {"message": "Welcome to Nook API"}
