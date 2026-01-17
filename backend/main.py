from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
import asyncio

app = FastAPI(title="Nook API", description="Your Window to the Best Writing")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, replace "*" with your Vercel URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class UnlockRequest(BaseModel) :
    url: str

MIRRORS = [
    'freedium-mirror.cfd',
    'readmedium.com',
    'freedium.cfd',
    'scribe.rip'
]

async def fetch_content(client, mirror_url: str):
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        response = await client.get(mirror_url, headers=headers, timeout=10.0, follow_redirects=True)
        
        # specific check for readmedium/freedium error states
        if "Failed to render" in response.text or "This site can’t be reached" in response.text:
            return None
            
        if response.status_code == 200:
            return response.text
    except Exception:
        return None
    return None

@app.post("/api/unlock")
async def unlock_article(request: UnlockRequest):
    async with httpx.AsyncClient() as client:
        # Try mirrors sequentially to find one that actually returns CONTENT
        for mirror_host in MIRRORS:
            # Construct URL
            from urllib.parse import urlparse, urlunparse
            parsed = urlparse(request.url)
            mirror_url = urlunparse(parsed._replace(netloc=mirror_host, scheme='https'))
            
            print(f"Attempting: {mirror_url}")
            content = await fetch_content(client, mirror_url)
            
            if content:
                # Basic parsing to verify it's an article (simple check)
                if "<article" in content or "<h1" in content:
                    return {
                        "success": True, 
                        "html": content, 
                        "source": mirror_host 
                    }
                
    raise HTTPException(status_code=503, detail="Could not retrieve article content from any source.")

@app.get("/")
def read_root():
    return {"message": "Welcome to Nook API"}
