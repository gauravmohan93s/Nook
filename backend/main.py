from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import httpx
import asyncio
from bs4 import BeautifulSoup
from urllib.parse import urljoin
from readability import Document
from sqlalchemy.orm import Session
from datetime import date
import io

# Import our new DB models
from models import SessionLocal, init_db, User, SavedArticle, UsageLog

# Initialize DB on startup
init_db()

app = FastAPI(title="Nook API", description="Your Window to the Best Writing")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class UnlockRequest(BaseModel):
    url: str

MIRRORS = [
    'freedium-mirror.cfd',
    'readmedium.com',
    'freedium.cfd',
    'scribe.rip'
]

# --- Helper: User Management & Limits ---
def get_current_user(x_user_email: str = Header(None), db: Session = Depends(get_db)):
    if not x_user_email:
        # If no login, treat as anonymous (maybe strict limit or block)
        # For now, we allow anonymous with strict limit, or just return None
        return None
    
    user = db.query(User).filter(User.email == x_user_email).first()
    if not user:
        user = User(email=x_user_email)
        db.add(user)
        db.commit()
        db.refresh(user)
    return user

def check_usage_limit(user: User, db: Session):
    if not user:
        return True # Anonymous users might have IP limit in future
        
    if user.tier != "seeker": # Insider/Patron have unlimited
        return True
        
    today_str = str(date.today())
    log = db.query(UsageLog).filter(UsageLog.user_id == user.id, UsageLog.date == today_str).first()
    
    if not log:
        log = UsageLog(user_id=user.id, date=today_str, count=0)
        db.add(log)
        db.commit()
    
    if log.count >= 3:
        return False
        
    # Increment usage
    log.count += 1
    db.commit()
    return True

@app.get("/api/proxy_image")
async def proxy_image(url: str):
    async with httpx.AsyncClient() as client:
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Referer': 'https://medium.com/'
            }
            resp = await client.get(url, headers=headers)
            return StreamingResponse(io.BytesIO(resp.content), media_type=resp.headers.get("content-type", "image/jpeg"))
        except:
            return HTTPException(status_code=404)

# --- Content Cleaning Logic (Existing) ---
def clean_html(html_content: str, base_url: str) -> str:
    # (Existing cleaning logic remains same, condensed for brevity in this replace)
    doc = Document(html_content)
    summary_html = doc.summary()
    title = doc.title()
    soup = BeautifulSoup(summary_html, 'html.parser')
    
    # ... (Keep existing image/code cleaning logic) ...
    for img in soup.find_all('img'):
        original_src = None
        if img.get('src'): original_src = urljoin(base_url, img['src'])
        if img.get('data-src') and not original_src: original_src = urljoin(base_url, img['data-src'])
        
        if original_src:
            # Rewrite to use OUR proxy
            # We assume backend is on port 8080. In prod, use relative or env var.
            img['src'] = f"http://localhost:8080/api/proxy_image?url={original_src}"
            
        img['referrerpolicy'] = "no-referrer"
        img['class'] = ['nook-img']
        if img.get('height'): del img['height']
        if img.get('width'): del img['width']
        if img.get('srcset'): del img['srcset']

    for pre in soup.find_all('pre'):
        pre['class'] = ['nook-code']
        if not pre.find('code'):
            code_tag = soup.new_tag('code')
            code_tag.string = pre.get_text()
            pre.string = ''
            pre.append(code_tag)

    subtitle = ""
    first_elem = soup.find(['p', 'h2', 'h3'])
    if first_elem and len(first_elem.get_text()) < 300:
        subtitle = first_elem.get_text()
        first_elem.decompose()

    return f"""
    <div class="nook-container">
        <header style="margin-bottom: 40px;">
            <h1 class="nook-title">{title}</h1>
            {f'<p class="nook-subtitle">{subtitle}</p>' if subtitle else ''}
        </header>
        {str(soup)}
    </div>
    """

async def fetch_content(client, mirror_url: str):
    try:
        headers = { 'User-Agent': 'Mozilla/5.0 ...' } # Shortened for brevity
        response = await client.get(mirror_url, headers=headers, timeout=10.0, follow_redirects=True)
        if "Failed to render" in response.text or "This site can’t be reached" in response.text: return None
        if response.status_code == 200: return clean_html(response.text, mirror_url)
    except Exception: return None
    return None

# --- API Endpoints ---

@app.post("/api/unlock")
async def unlock_article(
    request: UnlockRequest, 
    x_user_email: str = Header(None),
    db: Session = Depends(get_db)
):
    # 1. Check Limits
    user = get_current_user(x_user_email, db)
    if user:
        if not check_usage_limit(user, db):
            raise HTTPException(status_code=402, detail="Daily limit reached. Upgrade to Insider for unlimited reading.")

    async with httpx.AsyncClient() as client:
        # Try mirrors sequentially
        for mirror_host in MIRRORS:
            # Construct URL
            from urllib.parse import urlparse, urlunparse
            parsed = urlparse(request.url)
            mirror_url = urlunparse(parsed._replace(netloc=mirror_host, scheme='https'))
            
            content = await fetch_content(client, mirror_url)
            
            if content:
                # Basic parsing to verify it's an article
                if "<article" in content or "<h1" in content or "nook-title" in content:
                    return {
                        "success": True, 
                        "html": content, 
                        "source": mirror_host,
                        "remaining_reads": 3 - (user.usage_logs[-1].count if user and user.tier == 'seeker' else 0) if user else 3
                    }
                
    raise HTTPException(status_code=503, detail="Could not retrieve article content from any source.")

import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv()

# Configure Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# ... (Previous imports and code remain) ...

@app.post("/api/summarize")
async def summarize_article(request: UnlockRequest):
    if not GEMINI_API_KEY:
        return {"summary": "Gemini API Key not configured. Please add GEMINI_API_KEY to .env"}

    async with httpx.AsyncClient() as client:
        # 1. Fetch the content first (reuse existing logic logic)
        content = None
        for mirror_host in MIRRORS:
            from urllib.parse import urlparse, urlunparse
            parsed = urlparse(request.url)
            mirror_url = urlunparse(parsed._replace(netloc=mirror_host, scheme='https'))
            
            # Fetch raw html
            try:
                headers = { 'User-Agent': 'Mozilla/5.0 ...' }
                response = await client.get(mirror_url, headers=headers, timeout=10.0, follow_redirects=True)
                if response.status_code == 200:
                    # Clean it to get just text for the LLM
                    doc = Document(response.text)
                    soup = BeautifulSoup(doc.summary(), 'html.parser')
                    text = soup.get_text(separator=' ', strip=True)
                    if len(text) > 500:
                        content = text
                        break
            except:
                continue
        
        if not content:
            return {"summary": "Could not fetch article content to summarize."}

        # 2. Call Gemini
        try:
            # Dynamic Model Selection
            valid_model = None
            for m in genai.list_models():
                if 'generateContent' in m.supported_generation_methods:
                    if 'flash' in m.name: # Prefer Flash if available
                        valid_model = m.name
                        break
                    if 'pro' in m.name and not valid_model:
                        valid_model = m.name
            
            if not valid_model:
                valid_model = 'models/gemini-pro' # Fallback
                
            print(f"Using Gemini Model: {valid_model}")
            
            model = genai.GenerativeModel(valid_model)
            prompt = f"Summarize the following article in 3 concise, insightful bullet points. Focus on the main arguments and takeaways. \n\nArticle: {content[:10000]}"
            
            response = await model.generate_content_async(prompt)
            return {"summary": response.text}
        except Exception as e:
            print(f"Gemini Error: {e}")
            # Fallback for error visibility
            return {"summary": f"AI Summary unavailable: {str(e)}"}
        except Exception as e:
            return {"summary": f"Failed to generate summary: {str(e)}"}

@app.get("/api/speak")
async def speak_text(text: str):
    from gtts import gTTS
    # Generate audio
    tts = gTTS(text[:500], lang='en') # Limit to 500 chars for demo speed
    
    # Save to memory buffer
    audio_io = io.BytesIO()
    tts.write_to_fp(audio_io)
    audio_io.seek(0);
    
    return StreamingResponse(audio_io, media_type="audio/mp3")

@app.post("/api/save")
async def save_article(
    request: UnlockRequest, 
    title: str,
    x_user_email: str = Header(...),
    db: Session = Depends(get_db)
):
    user = get_current_user(x_user_email, db)
    if not user: raise HTTPException(status_code=401, detail="Login required")
    
    saved = SavedArticle(user_id=user.id, url=request.url, title=title)
    db.add(saved)
    db.commit()
    return {"success": True}

@app.get("/api/library")
async def get_library(
    x_user_email: str = Header(...),
    db: Session = Depends(get_db)
):
    user = get_current_user(x_user_email, db)
    if not user: raise HTTPException(status_code=401, detail="Login required")
    
    return user.saved_articles

@app.post("/api/upgrade")
async def upgrade_tier(
    x_user_email: str = Header(...),
    db: Session = Depends(get_db)
):
    user = get_current_user(x_user_email, db)
    if not user: raise HTTPException(status_code=401, detail="Login required")
    
    user.tier = "insider"
    db.commit()
    return {"success": True, "tier": "insider", "message": "Upgraded to Insider!"}


