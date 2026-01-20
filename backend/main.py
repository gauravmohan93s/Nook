from fastapi import FastAPI, HTTPException, Depends, Header, Request, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import httpx
import asyncio
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse, urlunparse, quote
from readability import Document
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import date, datetime, timedelta
import os
import io
import razorpay # CHANGED: Replaced Stripe with Razorpay

# JWT Verification
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

# Import our new DB models
from models import SessionLocal, init_db, User, SavedArticle, UsageLog, ContentCache

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

# Razorpay Config
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET")

# Initialize Razorpay Client
razorpay_client = None
if RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET:
    razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class UnlockRequest(BaseModel):
    url: str

MEDIUM_MIRRORS = [
    "freedium-mirror.cfd",
    "readmedium.com",
    "freedium.cfd",
    "scribe.rip",
]

MEDIUM_ALIASES = {
    "medium.com",
    "ai.gopubby.com",
    "ai.plainenglish.io",
    "andrewzuo.com",
    "article.darkiee.com",
    "articles.readytowork.jp",
    "astropagan.com",
    "atomic.engineering",
    "aws.plainenglish.io",
    "awstip.com",
    "baos.pub",
    "bettermarketing.pub",
    "betterprogramming.pub",
    "blog.angular.dev",
    "blog.bitsrc.io",
    "blog.curiosity.ai",
    "blog.det.life",
    "blog.devgenius.io",
    "blog.devops.dev",
    "blog.prototypr.io",
    "blog.ricofritzsche.de",
    "blog.stackademic.com",
    "code.likeagirl.io",
    "deep.sweet.pub",
    "drlee.io",
    "ehandbook.com",
    "fanfare.pub",
    "faun.pub",
    "generativeai.pub",
    "ideaswithwings.org",
    "infosecwriteups.com",
    "itnext.io",
    "javascript.plainenglish.io",
    "levelup.gitconnected.com",
    "li.earthonline.us",
    "medium.astrafy.io",
    "medium.datadriveninvestor.com",
    "medium.productcoalition.com",
    "muddyum.net",
    "programming.earthonline.us",
    "pub.aimind.so",
    "pub.towardsai.net",
    "publication.osintambition.org",
    "python.plainenglish.io",
    "readcultured.com",
    "towardsdatascience.com",
    "towardsdev.com",
    "uxdesign.cc",
    "writingcooperative.com",
    "www.eruditeelders.com",
    "yc.prosetech.com",
}

# --- Helper: User Management & Limits ---
def get_current_user(authorization: str = Header(None), db: Session = Depends(get_db)):
    if not authorization:
        return None
    
    try:
        if not authorization.startswith("Bearer "):
            return None
        token = authorization.split(" ")[1]
        
        client_id = os.getenv("AUTH_GOOGLE_ID") 
        id_info = id_token.verify_oauth2_token(token, google_requests.Request(), audience=client_id)
        
        email = id_info.get("email")
        if not email:
            return None
            
        user = db.query(User).filter(User.email == email).first()
        if not user:
            user = User(email=email)
            db.add(user)
            db.commit()
            db.refresh(user)
        return user
        
    except ValueError:
        return None
    except Exception as e:
        print(f"Auth Error: {e}")
        return None

def check_usage_limit(user: User, db: Session):
    if not user:
        return True 
        
    if user.tier != "seeker": 
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
async def proxy_image(url: str, referer: str = None):
    async with httpx.AsyncClient() as client:
        try:
            fallback_referer = "https://medium.com/"
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Referer': referer or fallback_referer
            }
            resp = await client.get(url, headers=headers)
            return StreamingResponse(io.BytesIO(resp.content), media_type=resp.headers.get("content-type", "image/jpeg"))
        except:
            return HTTPException(status_code=404)

@app.get("/api/health")
async def health_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable.")
    return {"status": "ok", "db": "ok"}

# --- Content Cleaning Logic (Existing) ---
def clean_html(html_content: str, base_url: str) -> str:
    # (Existing cleaning logic remains same, condensed for brevity in this replace)
    doc = Document(html_content)
    summary_html = doc.summary()
    title = doc.title()
    soup = BeautifulSoup(summary_html, 'html.parser')
    
    # ... (Keep existing image/code cleaning logic) ...
    api_base_url = os.getenv("API_BASE_URL", "http://localhost:8080")

    for img in soup.find_all('img'):
        original_src = None
        if img.get('src'): original_src = urljoin(base_url, img['src'])
        if img.get('data-src') and not original_src: original_src = urljoin(base_url, img['data-src'])

        if original_src:
            encoded_src = quote(original_src, safe="")
            encoded_ref = quote(base_url, safe="")
            img['src'] = f"{api_base_url}/api/proxy_image?url={encoded_src}&referer={encoded_ref}"
            
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

def extract_text_from_html(html_content: str) -> str:
    doc = Document(html_content)
    soup = BeautifulSoup(doc.summary(), "html.parser")
    return soup.get_text(separator=" ", strip=True)

def build_mirror_url(original_url: str, mirror_host: str) -> str:
    parsed = urlparse(original_url)
    return urlunparse(parsed._replace(netloc=mirror_host, scheme="https"))

async def fetch_clean_html(client, mirror_url: str):
    try:
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"}
        response = await client.get(
            mirror_url, headers=headers, timeout=10.0, follow_redirects=True
        )
        if "Failed to render" in response.text or "This site can’t be reached" in response.text:
            return None
        if response.status_code == 200:
            return clean_html(response.text, mirror_url)
    except Exception:
        return None
    return None

async def fetch_raw_html(client, mirror_url: str):
    try:
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"}
        response = await client.get(
            mirror_url, headers=headers, timeout=10.0, follow_redirects=True
        )
        if response.status_code == 200:
            return response.text
    except Exception:
        return None
    return None

class BaseAdapter:
    name = "base"
    license_type = "unknown"

    def can_handle(self, url: str) -> bool:
        return False

    async def fetch_html(self, client, url: str):
        return None

    async def fetch_text(self, client, url: str):
        return None

class MediumAdapter(BaseAdapter):
    name = "medium"
    license_type = "public-archive"

    def can_handle(self, url: str) -> bool:
        host = urlparse(url).netloc.lower()
        if host.endswith(".medium.com") or host == "medium.com":
            return True
        return host in MEDIUM_ALIASES

    async def fetch_html(self, client, url: str):
        for mirror_host in MEDIUM_MIRRORS:
            mirror_url = build_mirror_url(url, mirror_host)
            content = await fetch_clean_html(client, mirror_url)
            if content and (
                "<article" in content or "<h1" in content or "nook-title" in content
            ):
                return content
        return None

    async def fetch_text(self, client, url: str):
        for mirror_host in MEDIUM_MIRRORS:
            mirror_url = build_mirror_url(url, mirror_host)
            raw_html = await fetch_raw_html(client, mirror_url)
            if not raw_html:
                continue
            text = extract_text_from_html(raw_html)
            if len(text) > 500:
                return text
        return None

class ArxivAdapter(BaseAdapter):
    name = "arxiv"
    license_type = "open-access"

    def can_handle(self, url: str) -> bool:
        host = urlparse(url).netloc.lower()
        return host == "arxiv.org" or host == "www.arxiv.org"

    async def fetch_html(self, client, url: str):
        raw_html = await fetch_raw_html(client, url)
        if not raw_html:
            return None
        return clean_html(raw_html, url)

    async def fetch_text(self, client, url: str):
        raw_html = await fetch_raw_html(client, url)
        if not raw_html:
            return None
        text = extract_text_from_html(raw_html)
        if len(text) > 500:
            return text
        return None

class PubMedCentralAdapter(BaseAdapter):
    name = "pmc"
    license_type = "open-access"

    def can_handle(self, url: str) -> bool:
        host = urlparse(url).netloc.lower()
        return host == "www.ncbi.nlm.nih.gov" or host == "ncbi.nlm.nih.gov"

    async def fetch_html(self, client, url: str):
        if "/pmc/articles/" not in url:
            return None
        raw_html = await fetch_raw_html(client, url)
        if not raw_html:
            return None
        return clean_html(raw_html, url)

    async def fetch_text(self, client, url: str):
        if "/pmc/articles/" not in url:
            return None
        raw_html = await fetch_raw_html(client, url)
        if not raw_html:
            return None
        text = extract_text_from_html(raw_html)
        if len(text) > 500:
            return text
        return None

def abstract_from_inverted_index(inverted_index: dict) -> str:
    if not inverted_index:
        return ""
    positions = {}
    for word, idx_list in inverted_index.items():
        for idx in idx_list:
            positions[idx] = word
    if not positions:
        return ""
    max_index = max(positions.keys())
    words = []
    for i in range(max_index + 1):
        words.append(positions.get(i, ""))
    return " ".join([w for w in words if w]).strip()

class OpenAlexAdapter(BaseAdapter):
    name = "openalex"
    license_type = "open-access"

    def can_handle(self, url: str) -> bool:
        host = urlparse(url).netloc.lower()
        return host == "openalex.org" or host == "www.openalex.org"

    async def fetch_html(self, client, url: str):
        work_id = urlparse(url).path.strip("/").split("/")[0]
        if not work_id:
            return None
        api_url = f"https://api.openalex.org/works/{work_id}"
        try:
            resp = await client.get(api_url, timeout=10.0)
            if resp.status_code != 200:
                return None
            data = resp.json()
        except Exception:
            return None

        title = data.get("display_name") or "Untitled"
        authorships = data.get("authorships") or []
        authors = [a.get("author", {}).get("display_name") for a in authorships]
        authors = [a for a in authors if a]
        abstract = abstract_from_inverted_index(data.get("abstract_inverted_index"))
        publication_date = data.get("publication_date") or ""
        primary_location = data.get("primary_location", {}) or {}
        landing_url = primary_location.get("landing_page_url") or data.get("id")
        is_oa = (data.get("open_access") or {}).get("is_oa")
        self.license_type = "open-access" if is_oa else "unknown"

        authors_html = ""
        if authors:
            authors_html = "<p><strong>Authors:</strong> " + ", ".join(authors) + "</p>"

        abstract_html = ""
        if abstract:
            abstract_html = f"<p><strong>Abstract:</strong> {abstract}</p>"

        date_html = ""
        if publication_date:
            date_html = f"<p><strong>Published:</strong> {publication_date}</p>"

        link_html = ""
        if landing_url:
            link_html = f'<p><a href="{landing_url}" target="_blank" rel="noopener noreferrer">Source Link</a></p>'

        return f"""
        <div class="nook-container">
            <header style="margin-bottom: 24px;">
                <h1 class="nook-title">{title}</h1>
            </header>
            {authors_html}
            {date_html}
            {abstract_html}
            {link_html}
        </div>
        """

    async def fetch_text(self, client, url: str):
        work_id = urlparse(url).path.strip("/").split("/")[0]
        if not work_id:
            return None
        api_url = f"https://api.openalex.org/works/{work_id}"
        try:
            resp = await client.get(api_url, timeout=10.0)
            if resp.status_code != 200:
                return None
            data = resp.json()
        except Exception:
            return None
        abstract = abstract_from_inverted_index(data.get("abstract_inverted_index"))
        if abstract and len(abstract) > 100:
            return abstract
        return data.get("display_name") or None

class SemanticScholarAdapter(BaseAdapter):
    name = "semantic_scholar"
    license_type = "open-access"

    def can_handle(self, url: str) -> bool:
        host = urlparse(url).netloc.lower()
        return host == "semanticscholar.org" or host == "www.semanticscholar.org"

    def _extract_paper_id(self, url: str) -> str | None:
        parts = [p for p in urlparse(url).path.strip("/").split("/") if p]
        if not parts:
            return None
        if parts[0] == "paper" and len(parts) >= 2:
            return parts[-1]
        return parts[-1]

    async def fetch_html(self, client, url: str):
        paper_id = self._extract_paper_id(url)
        if not paper_id:
            return None
        api_key = os.getenv("SEMANTIC_SCHOLAR_API_KEY")
        if not api_key:
            return None

        fields = "title,authors,abstract,year,openAccessPdf,url"
        api_url = f"https://api.semanticscholar.org/graph/v1/paper/{paper_id}?fields={fields}"
        try:
            resp = await client.get(api_url, timeout=10.0, headers={"x-api-key": api_key})
            if resp.status_code != 200:
                return None
            data = resp.json()
        except Exception:
            return None

        title = data.get("title") or "Untitled"
        authors = [a.get("name") for a in data.get("authors") or [] if a.get("name")]
        abstract = data.get("abstract") or ""
        year = data.get("year") or ""
        landing_url = data.get("url") or ""
        oa_pdf = (data.get("openAccessPdf") or {}).get("url")
        self.license_type = "open-access" if oa_pdf else "unknown"

        authors_html = ""
        if authors:
            authors_html = "<p><strong>Authors:</strong> " + ", ".join(authors) + "</p>"

        abstract_html = ""
        if abstract:
            abstract_html = f"<p><strong>Abstract:</strong> {abstract}</p>"

        date_html = ""
        if year:
            date_html = f"<p><strong>Year:</strong> {year}</p>"

        link_html = ""
        if landing_url:
            link_html = f'<p><a href="{landing_url}" target="_blank" rel="noopener noreferrer">Source Link</a></p>'

        pdf_html = ""
        if oa_pdf:
            pdf_html = f'<p><a href="{oa_pdf}" target="_blank" rel="noopener noreferrer">Open Access PDF</a></p>'

        return f"""
        <div class="nook-container">
            <header style="margin-bottom: 24px;">
                <h1 class="nook-title">{title}</h1>
            </header>
            {authors_html}
            {date_html}
            {abstract_html}
            {link_html}
            {pdf_html}
        </div>
        """

    async def fetch_text(self, client, url: str):
        paper_id = self._extract_paper_id(url)
        if not paper_id:
            return None
        api_key = os.getenv("SEMANTIC_SCHOLAR_API_KEY")
        if not api_key:
            return None

        fields = "title,abstract"
        api_url = f"https://api.semanticscholar.org/graph/v1/paper/{paper_id}?fields={fields}"
        try:
            resp = await client.get(api_url, timeout=10.0, headers={"x-api-key": api_key})
            if resp.status_code != 200:
                return None
            data = resp.json()
        except Exception:
            return None

        abstract = data.get("abstract")
        if abstract and len(abstract) > 100:
            return abstract
        return data.get("title") or None

class GenericAdapter(BaseAdapter):
    name = "generic"
    license_type = "unknown"

    def can_handle(self, url: str) -> bool:
        return True

    async def fetch_html(self, client, url: str):
        raw_html = await fetch_raw_html(client, url)
        if not raw_html:
            return None
        return clean_html(raw_html, url)

    async def fetch_text(self, client, url: str):
        raw_html = await fetch_raw_html(client, url)
        if not raw_html:
            return None
        text = extract_text_from_html(raw_html)
        if len(text) > 500:
            return text
        return None

ADAPTERS = [
    MediumAdapter(),
    ArxivAdapter(),
    PubMedCentralAdapter(),
    OpenAlexAdapter(),
    SemanticScholarAdapter(),
    GenericAdapter(),
]

def get_adapter(url: str):
    for adapter in ADAPTERS:
        if adapter.can_handle(url):
            return adapter
    return None

CACHE_TTL_SECONDS = int(os.getenv("CACHE_TTL_SECONDS", "3600"))

def is_cache_fresh(entry: ContentCache) -> bool:
    if not entry or not entry.updated_at:
        return False
    age = datetime.utcnow() - entry.updated_at
    return age < timedelta(seconds=CACHE_TTL_SECONDS)

# --- API Endpoints ---

@app.post("/api/unlock")
async def unlock_article(
    request: UnlockRequest,
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    # 1. Check Limits
    user = get_current_user(authorization, db)
    if user:
        if not check_usage_limit(user, db):
            raise HTTPException(status_code=402, detail="Daily limit reached. Upgrade to Insider for unlimited reading.")

    adapter = get_adapter(request.url)
    if not adapter:
        raise HTTPException(status_code=400, detail="Unsupported source URL.")

    cached = db.query(ContentCache).filter(
        ContentCache.url == request.url,
        ContentCache.source == adapter.name
    ).first()
    if cached and cached.content_html and is_cache_fresh(cached):
        return {
            "success": True,
            "html": cached.content_html,
            "source": cached.source,
            "license": cached.license or adapter.license_type,
            "remaining_reads": 3 - (user.usage_logs[-1].count if user and user.tier == "seeker" else 0) if user else 3,
        }

    async with httpx.AsyncClient() as client:
        content = await adapter.fetch_html(client, request.url)

        if content:
            # Basic parsing to verify it's an article
            if "<article" in content or "<h1" in content or "nook-title" in content:
                if cached:
                    cached.content_html = content
                    cached.license = adapter.license_type
                    cached.updated_at = datetime.utcnow()
                else:
                    cached = ContentCache(
                        url=request.url,
                        source=adapter.name,
                        license=adapter.license_type,
                        content_html=content,
                    )
                    db.add(cached)
                db.commit()
                return {
                    "success": True,
                    "html": content,
                    "source": adapter.name,
                    "license": adapter.license_type,
                    "remaining_reads": 3 - (user.usage_logs[-1].count if user and user.tier == "seeker" else 0) if user else 3,
                }

    raise HTTPException(status_code=503, detail="Could not retrieve article content from any source.")

import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

# Configure Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

@app.post("/api/summarize")
async def summarize_article(
    request: UnlockRequest,
    db: Session = Depends(get_db)
):
    if not GEMINI_API_KEY:
        return {"summary": "Gemini API Key not configured. Please add GEMINI_API_KEY to .env"}

    adapter = get_adapter(request.url)
    if not adapter:
        raise HTTPException(status_code=400, detail="Unsupported source URL.")

    cached = db.query(ContentCache).filter(
        ContentCache.url == request.url,
        ContentCache.source == adapter.name
    ).first()
    if cached and cached.content_text and is_cache_fresh(cached):
        content = cached.content_text
    else:
        content = None

    async with httpx.AsyncClient() as client:
        # 1. Fetch the content first (adapter-specific)
        if not content:
            content = await adapter.fetch_text(client, request.url)
            if content:
                if cached:
                    cached.content_text = content
                    cached.license = adapter.license_type
                    cached.updated_at = datetime.utcnow()
                else:
                    cached = ContentCache(
                        url=request.url,
                        source=adapter.name,
                        license=adapter.license_type,
                        content_text=content,
                    )
                    db.add(cached)
                db.commit()

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
            prompt = f"""Summarize the following article in 3 concise, insightful bullet points. Focus on the main arguments and takeaways. 

Article: {content[:10000]}"""
            
            response = await model.generate_content_async(prompt)
            return {"summary": response.text}
        except Exception as e:
            print(f"Gemini Error: {e}")
            # Fallback for error visibility
            return {"summary": f"AI Summary unavailable: {str(e)}"}

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
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    user = get_current_user(authorization, db)
    if not user: raise HTTPException(status_code=401, detail="Login required")
    
    saved = SavedArticle(user_id=user.id, url=request.url, title=title)
    db.add(saved)
    db.commit()
    return {"success": True}

@app.get("/api/library")
async def get_library(
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    user = get_current_user(authorization, db)
    if not user: raise HTTPException(status_code=401, detail="Login required")
    
    return user.saved_articles

# --- Payments (Razorpay for India) ---

@app.post("/api/create-order")
async def create_order(
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    user = get_current_user(authorization, db)
    if not user: raise HTTPException(status_code=401, detail="Login required")

    try:
        if not razorpay_client:
            raise HTTPException(status_code=500, detail="Payment gateway not configured")

        # Create Razorpay Order
        # 299 INR = 29900 paise
        data = { "amount": 29900, "currency": "INR", "receipt": f"order_rcptid_{user.id}_{int(datetime.now().timestamp())}" }
        payment = razorpay_client.order.create(data=data)
        
        return {
            "order_id": payment['id'],
            "amount": payment['amount'],
            "currency": payment['currency'],
            "key_id": RAZORPAY_KEY_ID
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

class WebhookRequest(BaseModel):
    razorpay_payment_id: str
    razorpay_order_id: str
    razorpay_signature: str

@app.post("/api/verify-payment")
async def verify_payment(
    payload: WebhookRequest,
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    user = get_current_user(authorization, db)
    if not user: raise HTTPException(status_code=401, detail="Login required")
    
    try:
        if not razorpay_client:
            raise HTTPException(status_code=500, detail="Payment gateway not configured")

        # Verify Signature
        params_dict = {
            'razorpay_order_id': payload.razorpay_order_id,
            'razorpay_payment_id': payload.razorpay_payment_id,
            'razorpay_signature': payload.razorpay_signature
        }
        
        # This raises an error if signature is invalid
        razorpay_client.utility.verify_payment_signature(params_dict)
        
        # If we got here, payment is successful
        user.tier = "insider"
        db.commit()
        
        return {"status": "success", "message": "Upgraded to Insider!"}
        
    except razorpay.errors.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Payment verification failed")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
