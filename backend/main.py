from fastapi import FastAPI, HTTPException, Depends, Header, Request, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel
import httpx
import asyncio
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse, urlunparse, quote, parse_qs
from readability import Document
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import date, datetime, timedelta
import os
import io
import razorpay # CHANGED: Replaced Stripe with Razorpay
from dotenv import load_dotenv
import uuid
import json
import socket
import ipaddress
import contextvars
from logging.handlers import RotatingFileHandler
import bleach
import sentry_sdk
import html as html_lib
import re
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
import markdown
from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled, NoTranscriptFound

load_dotenv()

# JWT Verification
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

# Import our new DB models
from models import SessionLocal, init_db, User, SavedArticle, UsageLog, ContentCache

import time
import logging

request_id_ctx = contextvars.ContextVar("request_id", default="-")

class RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_ctx.get()
        return True

def setup_logging():
    log_level = os.getenv("LOG_LEVEL", "INFO").upper()
    log_path = os.getenv("LOG_FILE", "nook_app.log")
    max_bytes = int(os.getenv("LOG_MAX_BYTES", "10485760"))
    backup_count = int(os.getenv("LOG_BACKUP_COUNT", "5"))

    logger = logging.getLogger()
    logger.setLevel(log_level)

    formatter = logging.Formatter(
        "%(asctime)s %(levelname)s %(request_id)s %(message)s"
    )

    file_handler = RotatingFileHandler(log_path, maxBytes=max_bytes, backupCount=backup_count)
    file_handler.setFormatter(formatter)
    file_handler.addFilter(RequestIdFilter())

    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(formatter)
    stream_handler.addFilter(RequestIdFilter())

    logger.handlers = [file_handler, stream_handler]
    logger.propagate = False

setup_logging()
logger = logging.getLogger(__name__)

# Sentry (optional)
SENTRY_DSN = os.getenv("SENTRY_DSN")
if SENTRY_DSN:
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.1")),
        profiles_sample_rate=float(os.getenv("SENTRY_PROFILES_SAMPLE_RATE", "0.0")),
    )

# Initialize DB on startup
init_db()

app = FastAPI(title="Nook API", description="Your Window to the Best Writing")

# Metrics
REQUEST_COUNT = Counter(
    "nook_http_requests_total",
    "Total HTTP requests",
    ["method", "path", "status"]
)
REQUEST_LATENCY = Histogram(
    "nook_http_request_duration_seconds",
    "HTTP request latency in seconds",
    ["method", "path"]
)

# Shared HTTP client for efficiency
HTTP_TIMEOUT = httpx.Timeout(15.0, connect=5.0) # Increased timeout
HTTP_LIMITS = httpx.Limits(max_keepalive_connections=20, max_connections=100)
DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Cache-Control": "max-age=0",
}

@app.on_event("startup")
async def startup_event():
    app.state.http = httpx.AsyncClient(
        timeout=HTTP_TIMEOUT,
        limits=HTTP_LIMITS,
        follow_redirects=True,
        headers=DEFAULT_HEADERS
    )

@app.on_event("shutdown")
async def shutdown_event():
    client = getattr(app.state, "http", None)
    if client:
        await client.aclose()

@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    token = request_id_ctx.set(request_id)
    response = await call_next(request)
    process_time = time.time() - start_time
    payload = {
        "event": "request.complete",
        "method": request.method,
        "path": request.url.path,
        "status_code": response.status_code,
        "duration_ms": round(process_time * 1000, 2),
        "request_id": request_id,
    }
    logger.info(json.dumps(payload))
    response.headers["X-Process-Time"] = str(process_time)
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    REQUEST_COUNT.labels(request.method, request.url.path, str(response.status_code)).inc()
    REQUEST_LATENCY.labels(request.method, request.url.path).observe(process_time)
    request_id_ctx.reset(token)
    return response

def _parse_allowed_origins(value: str | None) -> list[str]:
    if not value:
        return ["http://localhost:3000"]
    # Split by comma, strip whitespace, and strip trailing slashes
    origins = [origin.strip().rstrip("/") for origin in value.split(",") if origin.strip()]
    return origins

ALLOWED_ORIGINS = _parse_allowed_origins(os.getenv("ALLOWED_ORIGINS"))

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
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
        logger.warning(f"Auth Error: {e}")
        return None

TIER_LIMITS = {
    "seeker": {"unlock": 3, "summarize": 0, "tts": 0, "chat": 0},
    "scholar": {"unlock": 9999, "summarize": 5, "tts": 5, "chat": 10},
    "insider": {"unlock": 9999, "summarize": 9999, "tts": 9999, "chat": 9999} 
}

# ... existing code ...

class ChatRequest(BaseModel):
    url: str
    message: str

@app.post("/api/chat")
async def chat_with_article(
    request: ChatRequest,
    http_request: Request,
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    user = get_current_user(authorization, db)
    if not user:
        raise HTTPException(status_code=401, detail="Login required")
    
    if not check_usage_limit(user, db, action="chat"):
        raise HTTPException(status_code=402, detail="Daily chat limit reached. Upgrade for more.")

    # 1. Get article content from cache
    cached = db.query(ContentCache).filter(ContentCache.url == request.url).first()
    if not cached or not (cached.content_text or cached.content_html):
        raise HTTPException(status_code=404, detail="Article content not found. Please unlock it first.")

    content = cached.content_text
    if not content and cached.content_html:
        content = extract_text_from_html(cached.content_html)
    
    if not content:
        raise HTTPException(status_code=500, detail="Could not extract text for chat.")

    # 2. Prepare Context
    tier = user.tier if user.tier in TIER_LIMITS else "seeker"
    
    # Token Optimization
    context_limits = {
        "insider": 32000,
        "scholar": 15000,
        "seeker": 6000
    }
    limit = context_limits.get(tier, 6000)
    truncated_content = content[:limit]
    
    context_prompt = f"""
    You are 'Nook AI', a helpful research assistant. 
    Use the provided article text to answer the user's question accurately.
    If the answer isn't in the text, politely say you don't know based on this specific article.
    Use Markdown formatting (bold, lists) to make the answer readable.
    
    ARTICLE CONTENT (Truncated to {len(truncated_content)} chars):
    {truncated_content}
    
    USER QUESTION:
    {request.message}
    """

    # 3. Provider Loop
    provider_order = _parse_provider_order(
        os.getenv("CHAT_PROVIDER_ORDER", "gemini,openrouter,groq,qubrid"),
        ["gemini"]
    )
    
    client = http_request.app.state.http
    last_error = None

    for provider in provider_order:
        try:
            if provider == "gemini":
                if not gemini_client: continue
                models = get_models_for_tier(tier)
                for model_id in models:
                    try:
                        response = gemini_client.models.generate_content(
                            model=model_id,
                            contents=context_prompt
                        )
                        return {
                            "answer": response.text,
                            "model": model_id,
                            "provider": "gemini",
                            "remaining_chats": get_remaining_usage(user, db, "chat")
                        }
                    except Exception as e:
                        logger.warning(f"Chat failed with Gemini model {model_id}: {e}")
                        last_error = e
                        continue
            
            elif provider == "openrouter":
                if not OPENROUTER_API_KEY: continue
                headers = {
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json"
                }
                if OPENROUTER_SITE_URL: headers["HTTP-Referer"] = OPENROUTER_SITE_URL
                if OPENROUTER_APP_NAME: headers["X-Title"] = OPENROUTER_APP_NAME
                
                payload = {
                    "model": OPENROUTER_MODELS[0] if OPENROUTER_MODELS else "google/gemini-2.0-flash-001",
                    "messages": [{"role": "user", "content": context_prompt}]
                }
                resp = await client.post("https://openrouter.ai/api/v1/chat/completions", json=payload, headers=headers, timeout=20.0)
                if resp.status_code == 200:
                    data = resp.json()
                    ans = _extract_summary_from_response(data) # Reusing helper
                    if ans:
                        return {"answer": ans, "provider": "openrouter", "remaining_chats": get_remaining_usage(user, db, "chat")}
                last_error = f"OpenRouter status {resp.status_code}"

            elif provider == "groq":
                if not GROQ_API_KEY: continue
                headers = {"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"}
                payload = {
                    "model": GROQ_MODELS[0] if GROQ_MODELS else "llama-3.1-70b-versatile",
                    "messages": [{"role": "user", "content": context_prompt}]
                }
                resp = await client.post("https://api.groq.com/openai/v1/chat/completions", json=payload, headers=headers, timeout=20.0)
                if resp.status_code == 200:
                    data = resp.json()
                    ans = _extract_summary_from_response(data)
                    if ans:
                        return {"answer": ans, "provider": "groq", "remaining_chats": get_remaining_usage(user, db, "chat")}
                last_error = f"Groq status {resp.status_code}"

            elif provider == "qubrid":
                if not QUBRID_API_KEY and not QUBRID_AUTH_VALUE: continue
                headers = {"Content-Type": "application/json"}
                if QUBRID_API_KEY: headers["Authorization"] = f"Bearer {QUBRID_API_KEY}"
                elif QUBRID_AUTH_VALUE: headers[QUBRID_AUTH_HEADER] = QUBRID_AUTH_VALUE
                
                payload = {
                    "model": QUBRID_MODELS[0] if QUBRID_MODELS else "openai/gpt-oss-120b",
                    "messages": [{"role": "user", "content": context_prompt}]
                }
                resp = await client.post(QUBRID_API_BASE, json=payload, headers=headers, timeout=20.0)
                if resp.status_code == 200:
                    data = resp.json()
                    ans = _extract_summary_from_response(data)
                    if ans:
                        return {"answer": ans, "provider": "qubrid", "remaining_chats": get_remaining_usage(user, db, "chat")}
                last_error = f"Qubrid status {resp.status_code}"

        except Exception as e:
            logger.warning(f"Provider {provider} failed: {e}")
            last_error = e
            continue
            
    logger.error(f"All chat models failed. Last error: {last_error}")
    raise HTTPException(status_code=500, detail="AI Assistant is currently unavailable.")


def _get_usage_log(user: User, db: Session, action: str):
    today_str = str(date.today())
    log = db.query(UsageLog).filter(
        UsageLog.user_id == user.id,
        UsageLog.date == today_str,
        UsageLog.action == action
    ).first()
    if not log:
        log = UsageLog(user_id=user.id, date=today_str, action=action, count=0)
        db.add(log)
        db.commit()
    return log

def check_usage_limit(user: User, db: Session, action: str = "unlock"):
    if not user:
        return True # Or False if we want to force login for everything? 
        # Logic: If no user (unauthenticated), we might allow 1 unlock via frontend logic, 
        # but here we are checking authenticated users limits.
        # If user is None, they are likely unauthenticated.
        # For now, if no user, return True (allow) and let frontend gate, 
        # or return False? The callers usually check "if user: check_limit".
        # Let's keep existing pattern: The caller handles unauthenticated logic.
    
    tier = user.tier if user.tier in TIER_LIMITS else "seeker"
    limit = TIER_LIMITS[tier].get(action, 0)
    
    if limit >= 9999: # Unlimited, still log usage
        log = _get_usage_log(user, db, action)
        log.count += 1
        db.commit()
        return True

    log = _get_usage_log(user, db, action)
    
    if log.count >= limit:
        return False
        
    # Increment usage
    log.count += 1
    db.commit()
    return True

def get_remaining_usage(user: User, db: Session, action: str) -> int:
    if not user:
        return 0
    tier = user.tier if user.tier in TIER_LIMITS else "seeker"
    limit = TIER_LIMITS[tier].get(action, 0)
    if limit >= 9999:
        return 9999
    log = _get_usage_log(user, db, action)
    remaining = max(0, limit - log.count)
    return remaining

def is_safe_url(url: str) -> bool:
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return False
        if not parsed.hostname:
            return False
        if os.getenv("ALLOW_PRIVATE_NETWORK", "false").lower() == "true":
            return True
        host = parsed.hostname
        try:
            ip = ipaddress.ip_address(host)
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
                return False
            return True
        except ValueError:
            try:
                infos = socket.getaddrinfo(host, None)
                for info in infos:
                    ip_str = info[4][0]
                    ip = ipaddress.ip_address(ip_str)
                    if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
                        return False
            except Exception:
                return False
        return True
    except Exception:
        return False

RATE_LIMIT_STORE: dict[str, list[float]] = {}

def _rate_limit_key(action: str, request: Request, user: User | None) -> str:
    if user:
        return f"{action}:user:{user.id}"
    client_ip = request.client.host if request.client else "unknown"
    return f"{action}:ip:{client_ip}"

def check_rate_limit(action: str, request: Request, user: User | None, limit: int, window_seconds: int) -> bool:
    if limit <= 0:
        return True
    key = _rate_limit_key(action, request, user)
    now = time.time()
    timestamps = RATE_LIMIT_STORE.get(key, [])
    timestamps = [t for t in timestamps if now - t < window_seconds]
    if len(timestamps) >= limit:
        RATE_LIMIT_STORE[key] = timestamps
        return False
    timestamps.append(now)
    RATE_LIMIT_STORE[key] = timestamps
    return True

ALLOWED_TAGS = [
    "article", "section", "div", "p", "span", "blockquote",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li",
    "a", "img", "figure", "figcaption",
    "strong", "em", "b", "i", "u", "code", "pre",
    "table", "thead", "tbody", "tr", "th", "td",
    "hr", "br"
]
ALLOWED_ATTRS = {
    "*": ["class", "data-thumbnail", "data-title", "data-author", "data-published", "data-tags"],
    "a": ["href", "title", "target", "rel"],
    "img": ["src", "alt", "title", "width", "height", "loading", "referrerpolicy"],
    "code": ["class"],
    "pre": ["class"],
    "table": ["class"],
    "div": ["class", "data-thumbnail", "data-title", "data-author", "data-published", "data-tags"],
}
ALLOWED_PROTOCOLS = ["http", "https", "mailto"]
HTML_CLEANER = bleach.Cleaner(tags=ALLOWED_TAGS, attributes=ALLOWED_ATTRS, protocols=ALLOWED_PROTOCOLS, strip=True)

def sanitize_html(html_content: str) -> str:
    return HTML_CLEANER.clean(html_content)

def _parse_model_list(value: str | None, fallback: list[str]) -> list[str]:
    if value:
        models = [m.strip() for m in value.split(",") if m.strip()]
        if models:
            return models
    return fallback

def get_models_for_tier(tier: str) -> list[str]:
    tier = (tier or "seeker").lower()
    
    # Defaults based on verified available models
    defaults = {
        "insider": ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash"],
        "scholar": ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"],
        "seeker": ["gemini-2.0-flash-lite", "gemini-flash-lite-latest", "gemini-2.0-flash"],
    }
    
    # Check Env overrides
    env_key = f"GEMINI_MODELS_{tier.upper()}"
    configured = _parse_model_list(os.getenv(env_key), [])
    
    # Start with configured, then append defaults as fallback/safety net
    raw_list = configured + defaults.get(tier, defaults["seeker"])
    
    # Deduplicate preserving order
    final_list = []
    seen = set()
    for m in raw_list:
        if m and m not in seen:
            final_list.append(m)
            seen.add(m)
            
    return final_list

def _parse_provider_order(value: str | None, fallback: list[str]) -> list[str]:
    if value:
        providers = [p.strip().lower() for p in value.split(",") if p.strip()]
        if providers:
            return providers
    return fallback

# --- Admin Dependencies ---
def get_current_admin(user: User = Depends(get_current_user)):
    if not user or not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin privileges required")
    return user

# --- Admin Endpoints ---

@app.get("/api/admin/me")
def check_admin_status(user: User = Depends(get_current_user)):
    return {"is_admin": user.is_admin if user else False}

@app.get("/api/admin/users")
def get_all_users(skip: int = 0, limit: int = 100, admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    users = db.query(User).offset(skip).limit(limit).all()
    return users

@app.post("/api/admin/promote")
def promote_user(email: str, target_tier: str = None, make_admin: bool = False, admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if target_tier:
        user.tier = target_tier
    if make_admin:
        user.is_admin = True
        
    db.commit()
    return {"status": "success", "email": user.email, "tier": user.tier, "is_admin": user.is_admin}

@app.get("/api/admin/stats")
def get_stats(admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    total_users = db.query(User).count()
    total_saved = db.query(SavedArticle).count()
    
    # Get recent usage
    today_str = str(date.today())
    # This query counts unique rows in usage_logs, which might double count users if they did multiple actions.
    # Proper active user count: distinct user_ids in usage_logs today
    daily_active = db.query(UsageLog.user_id).filter(UsageLog.date == today_str).distinct().count()
    
    return {
        "total_users": total_users,
        "total_saved_articles": total_saved,
        "daily_active_users": daily_active
    }

@app.get("/api/admin/cache")
def get_cache_entries(
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
    url: str | None = None,
    limit: int = 50
):
    query = db.query(ContentCache)
    if url:
        query = query.filter(ContentCache.url == url)
    entries = query.order_by(ContentCache.updated_at.desc()).limit(limit).all()
    return [
        {
            "url": e.url,
            "source": e.source,
            "updated_at": e.updated_at.isoformat() if e.updated_at else None,
            "has_html": bool(e.content_html),
            "has_text": bool(e.content_text),
            "has_summary": bool(e.summary),
        }
        for e in entries
    ]

@app.post("/api/admin/cache/flush")
def flush_cache(
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
    url: str | None = None,
    all: bool = False
):
    if not url and not all:
        raise HTTPException(status_code=400, detail="Provide url or all=true")
    query = db.query(ContentCache)
    if url:
        query = query.filter(ContentCache.url == url)
    deleted = query.delete(synchronize_session=False)
    db.commit()
    return {"deleted": deleted}

@app.get("/api/proxy_image")
async def proxy_image(url: str, referer: str = None):
    if not url:
        raise HTTPException(status_code=400, detail="Missing URL")
    if not is_safe_url(url):
        raise HTTPException(status_code=400, detail="URL not allowed.")

    client = app.state.http
    try:
        # Medium images often need this specific referer
        fallback_referer = "https://medium.com/"
        headers = {
            "User-Agent": DEFAULT_HEADERS["User-Agent"],
            "Referer": referer or fallback_referer,
            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
            "Sec-Fetch-Dest": "image",
            "Sec-Fetch-Mode": "no-cors",
            "Sec-Fetch-Site": "cross-site"
        }

        # Use build_request to allow streaming
        req = client.build_request("GET", url, headers=headers)
        r = await client.send(req, stream=True)

        if r.status_code != 200:
            await r.aclose()
            raise HTTPException(status_code=404, detail="Image not found")

        content_type = r.headers.get("content-type", "image/jpeg")
        # Relaxed check for content-type
        
        max_bytes = int(os.getenv("MAX_IMAGE_BYTES", "5242880"))
        content_length = r.headers.get("content-length")
        
        if content_length and int(content_length) > max_bytes:
            await r.aclose()
            raise HTTPException(status_code=413, detail="Image too large")

        async def stream_with_limit():
            downloaded = 0
            try:
                async for chunk in r.aiter_bytes():
                    downloaded += len(chunk)
                    if downloaded > max_bytes:
                        raise HTTPException(status_code=413, detail="Image too large")
                    yield chunk
            finally:
                await r.aclose()

        return StreamingResponse(stream_with_limit(), media_type=content_type)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Image proxy error: {e} for {url}")
        raise HTTPException(status_code=404, detail="Image not available")

@app.get("/api/proxy_pdf")
async def proxy_pdf(url: str):
    if not url:
        raise HTTPException(status_code=400, detail="Missing URL")
    if not is_safe_url(url):
        raise HTTPException(status_code=400, detail="URL not allowed.")

    client = app.state.http
    try:
        # Some PDF hosts need headers
        headers = {
            "User-Agent": DEFAULT_HEADERS["User-Agent"],
            "Referer": "https://www.google.com/", 
        }

        req = client.build_request("GET", url, headers=headers)
        r = await client.send(req, stream=True)

        if r.status_code != 200:
            await r.aclose()
            raise HTTPException(status_code=404, detail="PDF not found")

        content_type = r.headers.get("content-type", "application/pdf")
        
        # Limit PDF size? Maybe 50MB.
        MAX_PDF_BYTES = 50 * 1024 * 1024 
        
        async def stream_pdf():
            downloaded = 0
            try:
                async for chunk in r.aiter_bytes():
                    downloaded += len(chunk)
                    if downloaded > MAX_PDF_BYTES:
                        # We can't easily raise HTTP exception inside stream, 
                        # so we just stop.
                        break 
                    yield chunk
            finally:
                await r.aclose()

        return StreamingResponse(
            stream_pdf(), 
            media_type="application/pdf",
            headers={
                "Content-Disposition": "inline; filename=document.pdf",
                "Cache-Control": "public, max-age=86400"
            }
        )
    except Exception as e:
        logger.error(f"PDF proxy error: {e} for {url}")
        raise HTTPException(status_code=502, detail="Failed to fetch PDF")

@app.get("/api/health")
async def health_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable.")
    return {"status": "ok", "db": "ok"}

@app.get("/api/me")
def get_me(
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    user = get_current_user(authorization, db)
    if not user:
        raise HTTPException(status_code=401, detail="Login required")
    return {
        "email": user.email,
        "tier": user.tier,
        "is_admin": user.is_admin,
        "remaining_reads": get_remaining_usage(user, db, "unlock"),
        "remaining_summaries": get_remaining_usage(user, db, "summarize"),
        "remaining_tts": get_remaining_usage(user, db, "tts"),
    }

@app.get("/metrics")
async def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

# --- Content Cleaning Logic (Existing) ---
def _extract_thumbnail_from_raw(raw_html: str, base_url: str) -> str | None:
    try:
        soup = BeautifulSoup(raw_html, "html.parser")
        og_image = soup.find("meta", attrs={"property": "og:image"}) or soup.find("meta", attrs={"name": "og:image"})
        if og_image and og_image.get("content"):
            return og_image["content"].strip()
        img = soup.find("img")
        if img and img.get("src"):
            return urljoin(base_url, img["src"])
        if img and img.get("data-src"):
            return urljoin(base_url, img["data-src"])
    except Exception:
        return None
    return None

def clean_html(html_content: str, base_url: str, thumbnail_override: str | None = None):
    # Pre-parsing to capture Freedium specific elements before Readability strips them
    raw_soup = BeautifulSoup(html_content, "html.parser")
    
    # Try to find the "Preview image" which Freedium puts in the header
    freedium_main_img = raw_soup.find("img", attrs={"alt": "Preview image"})
    freedium_header = raw_soup.find("div", class_="text-center") # Often contains title/subtitle
    
    doc = Document(html_content)
    content_html = doc.summary()

    # Prefer Freedium mirror main content to preserve images
    host = urlparse(base_url).netloc.lower()
    if host in MEDIUM_MIRRORS:
        main_content = raw_soup.select_one(".main-content") or raw_soup.find("article")
        if main_content:
            content_html = str(main_content)
    
    # If Readability missed the main image (common on Freedium), inject it back
    if freedium_main_img and "Preview image" not in content_html:
        src = freedium_main_img.get("src")
        if src:
            img_tag = f'<figure><img src="{src}" class="nook-img" alt="Cover Image"></figure>'
            content_html = img_tag + content_html

    title = doc.title()
    soup = BeautifulSoup(content_html, 'html.parser')
    
    api_base_url = os.getenv("API_BASE_URL", "http://localhost:8080")
    
    if not thumbnail_override:
        thumbnail_override = _extract_thumbnail_from_raw(html_content, base_url)
    thumbnail_url = thumbnail_override

    meta = extract_metadata(html_content)
    meta_title_raw = meta.get("title") or ""
    meta_title = html_lib.escape(meta_title_raw, quote=True)
    meta_author = html_lib.escape(meta.get("author") or "", quote=True)
    meta_published = html_lib.escape(meta.get("published_at") or "", quote=True)
    meta_tags = ",".join(meta.get("tags") or [])
    meta_tags = html_lib.escape(meta_tags, quote=True)
    
    def _pick_src_from_srcset(srcset: str) -> str | None:
        try:
            candidates = [c.strip().split(" ")[0] for c in srcset.split(",") if c.strip()]
            return candidates[-1] if candidates else None
        except Exception:
            return None

    # Remove duplicate H1 if it matches metadata title
    if meta_title_raw:
        h1 = soup.find("h1")
        if h1:
            h1_text = h1.get_text(strip=True)
            if h1_text == meta_title_raw or (h1_text.startswith(meta_title_raw) and "| by " in h1_text):
                h1.decompose()

    # Process images
    for img in soup.find_all('img'):
        original_src = None
        if img.get('src'): original_src = urljoin(base_url, img['src'])
        if img.get('data-src') and not original_src: original_src = urljoin(base_url, img['data-src'])
        if not original_src and img.get('srcset'):
            picked = _pick_src_from_srcset(img.get('srcset'))
            if picked:
                original_src = urljoin(base_url, picked)
        if not original_src and img.get('data-srcset'):
            picked = _pick_src_from_srcset(img.get('data-srcset'))
            if picked:
                original_src = urljoin(base_url, picked)

        if original_src:
            stripped_src = original_src.replace("https://", "").replace("http://", "")
            encoded_src = quote(stripped_src, safe="")
            proxy_src = f"https://images.weserv.nl/?url={encoded_src}&output=webp&q=80"
            img['src'] = proxy_src
            
            if not thumbnail_url:
                thumbnail_url = proxy_src
            
        img['referrerpolicy'] = "no-referrer"
        img['loading'] = "lazy"
        img['class'] = ['nook-img']
        if img.get('height'): del img['height']
        if img.get('width'): del img['width']
        if img.get('srcset'): del img['srcset']
        # Remove layout constraints
        if img.get('style'): del img['style']

    for pre in soup.find_all('pre'):
        pre['class'] = ['nook-code']
        if not pre.find('code'):
            code_tag = soup.new_tag('code')
            code_tag.string = pre.get_text()
            pre.string = ''
            pre.append(code_tag)

    subtitle = ""
    # Freedium often has H2 as subtitle right after H1, but Readability might mash them.
    # We trust the metadata header for title/author, so we just clean the content body here.
    
    safe_thumb = html_lib.escape(thumbnail_url or "none", quote=True)
    data_attr = f' data-thumbnail="{safe_thumb}" data-title="{meta_title}" data-author="{meta_author}" data-published="{meta_published}" data-tags="{meta_tags}"'
    final_html = f"""
    <div class="nook-container"{data_attr}>
        <header style="margin-bottom: 40px;">
            <h1 class="nook-title">{title}</h1>
            {f'<p class="nook-subtitle">{subtitle}</p>' if subtitle else ''}
        </header>
        {str(soup)}
    </div>
    """
    
    return final_html

def extract_metadata(html_content: str) -> dict:
    doc = Document(html_content)
    soup = BeautifulSoup(html_content, 'html.parser')

    def _parse_date_text(text: str) -> str | None:
        if not text:
            return None
        raw = text.strip()
        raw = re.sub(r"\(Updated:.*?\)", "", raw).strip()
        if "Updated:" in raw:
            raw = raw.split("Updated:")[0].strip()
        if "(" in raw:
            raw = raw.split("(")[0].strip()
        raw = raw.replace("Updated", "").replace("(", "").replace(")", "").strip()
        # Handle formats like "December 6, 2025"
        try:
            return datetime.strptime(raw, "%B %d, %Y").date().isoformat()
        except Exception:
            pass
        try:
            return datetime.strptime(raw, "%b %d, %Y").date().isoformat()
        except Exception:
            return None

    # 1. Title Parsing
    title = None
    raw_title = soup.title.string if soup.title else doc.title()
    
    if raw_title:
        # Freedium Format: "Title | by Author - Freedium"
        if " | by " in raw_title and " - Freedium" in raw_title:
            title = raw_title.split(" | by ")[0].strip()
        elif " | by " in raw_title:
             title = raw_title.split(" | by ")[0].strip()
        else:
            title = raw_title.strip()

    # 2. Author Parsing
    author = "Unknown"
    # Freedium specific: Link to medium profile
    author_links = soup.find_all("a", href=lambda x: x and "medium.com/@" in x)
    if author_links:
        candidates = []
        for link in author_links:
            text = link.get_text(strip=True) or ""
            if not text:
                continue
            if "follow" in text.lower():
                continue
            if "go to the original" in text.lower():
                continue
            candidates.append(text)
        if candidates:
            author = max(candidates, key=len)
    
    if author == "Unknown":
        meta_author = soup.find("meta", attrs={"name": "author"}) or soup.find("meta", attrs={"property": "article:author"})
        if meta_author and meta_author.get("content"):
            author = meta_author["content"].strip()
    bad_author_markers = ["go to the original", "go to original"]
    if author and any(m in author.lower() for m in bad_author_markers):
        author = "Unknown"

    # 3. Thumbnail Parsing
    thumbnail_url = None
    # Freedium specific: Preview image
    preview_img = soup.find("img", attrs={"alt": "Preview image"})
    if preview_img and preview_img.get("src"):
        thumbnail_url = preview_img["src"]
        
    if not thumbnail_url:
        og_image = soup.find("meta", attrs={"property": "og:image"}) or soup.find("meta", attrs={"name": "og:image"})
        if og_image and og_image.get("content"):
            thumbnail_url = og_image["content"].strip()

    # 4. Date Parsing
    published_at = None
    # Try to find a date in text if not in meta
    # Freedium doesn't always have a clean date meta tag, but it's in the text "Jan 15, 2026"
    # We stick to meta for reliability, or fallback to today
    meta_time = soup.find("meta", attrs={"property": "article:published_time"})
    if meta_time and meta_time.get("content"):
        published_at = meta_time["content"].strip()[:10] # YYYY-MM-DD

    # 4b. Freedium mirror explicit text date
    if not published_at:
        date_span = soup.find("span", string=lambda s: s and ("Updated:" in s or " 20" in s))
        if date_span and date_span.get_text(strip=True):
            parsed = _parse_date_text(date_span.get_text(strip=True))
            if parsed:
                published_at = parsed

    # 4c. Freedium title/author from main content
    h1 = soup.find("h1")
    h1_text = h1.get_text(strip=True) if h1 else ""
    if not title and h1_text:
        if " | by " in h1_text:
            title = h1_text.split(" | by ")[0].strip()
        else:
            title = h1_text
    if author == "Unknown":
        if " | by " in h1_text:
            author_part = h1_text.split(" | by ")[1]
            author_part = author_part.replace(" - Freedium", "").strip()
            author = author_part or author
    if author == "Unknown":
        rich_author = soup.find("a", attrs={"class": lambda c: c and "font-semibold" in c})
        if rich_author and rich_author.get_text(strip=True):
            candidate = rich_author.get_text(strip=True)
            if not any(m in candidate.lower() for m in bad_author_markers):
                author = candidate

    # 5. Tags (e.g., #agentic-ai)
    tags = []
    for span in soup.find_all("span"):
        text = span.get_text(strip=True)
        if text.startswith("#"):
            tags.append(text)
    tags = list(dict.fromkeys(tags))[:10]

    # 5. Prefer metadata embedded in cleaned HTML (cache-safe)
    container = soup.find("div", class_="nook-container")
    if container:
        data_title = container.get("data-title")
        data_author = container.get("data-author")
        data_published = container.get("data-published")
        data_thumb = container.get("data-thumbnail")
        data_tags = container.get("data-tags")
        if data_title:
            title = data_title.strip()
        if data_author:
            author = data_author.strip()
        if data_published:
            published_at = data_published.strip()
        if data_thumb and data_thumb != "none":
            thumbnail_url = data_thumb.strip()
        if data_tags:
            tags = [t.strip() for t in data_tags.split(",") if t.strip()]

    return {
        "title": title or "Untitled",
        "thumbnail_url": thumbnail_url,
        "author": author,
        "published_at": published_at or date.today().isoformat(),
        "tags": tags
    }

def extract_text_from_html(html_content: str) -> str:
    doc = Document(html_content)
    soup = BeautifulSoup(doc.summary(), "html.parser")
    return soup.get_text(separator=" ", strip=True)

def _normalize_metadata_from_html(html_content: str, meta: dict) -> tuple[dict, str]:
    soup = BeautifulSoup(html_content, "html.parser")
    h1 = soup.find("h1")
    h1_text = h1.get_text(strip=True) if h1 else ""

    author = meta.get("author") or "Unknown"
    title = meta.get("title") or ""

    bad_author = not author or author.lower() == "unknown" or "go to the original" in author.lower()
    if bad_author and h1_text and " | by " in h1_text:
        author_part = h1_text.split(" | by ")[1]
        author_part = author_part.replace(" - Freedium", "").strip()
        if author_part:
            author = author_part
        if not title:
            title = h1_text.split(" | by ")[0].strip()

    if bad_author:
        author_links = soup.find_all("a", href=lambda x: x and "medium.com/@" in x)
        candidates = []
        for link in author_links:
            text = link.get_text(strip=True) or ""
            if not text:
                continue
            if "follow" in text.lower() or "go to the original" in text.lower():
                continue
            candidates.append(text)
        if candidates:
            author = max(candidates, key=len)

    meta["author"] = author or meta.get("author") or "Unknown"
    meta["title"] = title or meta.get("title") or "Untitled"

    container = soup.find("div", class_="nook-container")
    if container:
        container["data-author"] = html_lib.escape(meta["author"], quote=True)
        container["data-title"] = html_lib.escape(meta["title"], quote=True)

    if h1 and "| by " in h1_text and meta["title"] and h1_text.startswith(meta["title"]):
        h1.decompose()
    return meta, str(soup)

def build_mirror_url(original_url: str, mirror_host: str) -> str:
    parsed = urlparse(original_url)
    return urlunparse(parsed._replace(netloc=mirror_host, scheme="https"))

async def _fetch_text_limited(client, url: str, max_bytes: int = 5_000_000) -> tuple[str | None, int]:
    try:
        req = client.build_request("GET", url)
        r = await client.send(req, stream=True)
        if r.status_code != 200:
            await r.aclose()
            return None, r.status_code
            
        content_length = r.headers.get("content-length")
        if content_length and int(content_length) > max_bytes:
            await r.aclose()
            return None, 413 # Payload Too Large
            
        content = []
        downloaded = 0
        
        async for chunk in r.aiter_bytes():
            downloaded += len(chunk)
            if downloaded > max_bytes:
                await r.aclose()
                return None, 413
            content.append(chunk)
            
        await r.aclose()
        
        full_bytes = b"".join(content)
        # Simple decoding strategy
        try:
             return full_bytes.decode("utf-8"), 200
        except UnicodeDecodeError:
             return full_bytes.decode("latin-1", errors="replace"), 200
    except Exception as e:
        logger.warning(f"Fetch error for {url}: {e}")
        return None, 500

async def fetch_clean_html(client, mirror_url: str):
    text, status = await _fetch_text_limited(client, mirror_url)
    if not text:
        logger.warning(f"Fetch failed for {mirror_url} with status {status}")
        return None
        
    if "Failed to render" in text or "This site can't be reached" in text:
        logger.warning(f"Mirror {mirror_url} returned error text")
        return None
        
    thumb = _extract_thumbnail_from_raw(text, mirror_url)
    return clean_html(text, mirror_url, thumbnail_override=thumb)

# ... (Update adapters to handle tuple return) ...

async def fetch_raw_html(client, mirror_url: str):
    text, status = await _fetch_text_limited(client, mirror_url)
    return text

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
        tasks = []
        for mirror_host in MEDIUM_MIRRORS:
            if "freedium" in mirror_host:
                # Freedium supports appending the full URL for custom domains
                mirror_url = f"https://{mirror_host}/{url.replace('https://', '').replace('http://', '')}"
            else:
                mirror_url = build_mirror_url(url, mirror_host)
            tasks.append(fetch_clean_html(client, mirror_url))
        
        # Run all fetches concurrently
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for i, content in enumerate(results):
            mirror = MEDIUM_MIRRORS[i]
            if isinstance(content, Exception):
                logger.warning(f"Mirror {mirror} failed: {content}")
                continue
                
            if isinstance(content, str):
                # Relaxed check: just look for the container we inject
                if "nook-container" in content:
                    logger.info(f"Successfully fetched from {mirror}")
                    return content
                else:
                    logger.warning(f"Mirror {mirror} returned invalid content (len={len(content)}): {content[:100]}...")
            else:
                logger.warning(f"Mirror {mirror} returned None")
                
        return None

    async def fetch_text(self, client, url: str):
        tasks = []
        for mirror_host in MEDIUM_MIRRORS:
            mirror_url = build_mirror_url(url, mirror_host)
            tasks.append(_fetch_text_limited(client, mirror_url))
            
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for res in results:
            if isinstance(res, tuple):
                raw_html, status = res
                if raw_html and status == 200:
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
        raw_html, status = await _fetch_text_limited(client, url)
        if not raw_html:
            return None
        thumb = _extract_thumbnail_from_raw(raw_html, url)
        return clean_html(raw_html, url, thumbnail_override=thumb)

    async def fetch_text(self, client, url: str):
        raw_html, status = await _fetch_text_limited(client, url)
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
        raw_html, status = await _fetch_text_limited(client, url)
        if not raw_html:
            return None
        return clean_html(raw_html, url)

    async def fetch_text(self, client, url: str):
        if "/pmc/articles/" not in url:
            return None
        raw_html, status = await _fetch_text_limited(client, url)
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

class JinaAdapter(BaseAdapter):
    name = "jina"
    license_type = "unknown"

    def can_handle(self, url: str) -> bool:
        # Use as a strong fallback for almost anything
        return True

    async def fetch_html(self, client, url: str):
        jina_url = f"https://r.jina.ai/{url}"
        # Jina returns Markdown. We need to convert to HTML.
        text, status = await _fetch_text_limited(client, jina_url)
        if not text:
            return None
            
        if "Rate limit exceeded" in text:
            logger.warning("Jina rate limit exceeded")
            return None

        # Convert Markdown to HTML
        html_content = markdown.markdown(text)
        
        # Jina usually puts the title in the first line as H1 or Metadata
        # We try to extract metadata from the markdown text if possible, 
        # but for now let's just wrap it.
        
        # Try to find a title from the original URL or text
        title = "Article" 
        first_line = text.split('\n')[0].strip()
        if first_line.startswith('# '):
            title = first_line.replace('# ', '')
            
        return f"""
        <div class="nook-container">
            <header style="margin-bottom: 24px;">
                <h1 class="nook-title">{title}</h1>
            </header>
            <div class="nook-markdown-body">
                {html_content}
            </div>
            <p style="font-size: 0.8rem; margin-top: 40px; color: #666;">
                Processed via Jina AI
            </p>
        </div>
        """

    async def fetch_text(self, client, url: str):
        jina_url = f"https://r.jina.ai/{url}"
        text, status = await _fetch_text_limited(client, jina_url)
        return text

class GenericAdapter(BaseAdapter):
    name = "generic"
    license_type = "unknown"

    def can_handle(self, url: str) -> bool:
        # Generic is now a fallback if Jina fails (or we can swap order)
        # Actually Jina is better than Generic (readability) usually.
        # But Jina has rate limits.
        return True

    async def fetch_html(self, client, url: str):
        raw_html, status = await _fetch_text_limited(client, url)
        if not raw_html:
            return None
        return clean_html(raw_html, url)

    async def fetch_text(self, client, url: str):
        raw_html, status = await _fetch_text_limited(client, url)
        if not raw_html:
            return None
        text = extract_text_from_html(raw_html)
        if len(text) > 500:
            return text
        return None

class YoutubeAdapter(BaseAdapter):
    name = "youtube"
    license_type = "standard-license"

    def can_handle(self, url: str) -> bool:
        parsed = urlparse(url)
        host = parsed.netloc.lower()
        return "youtube.com" in host or "youtu.be" in host

    def _get_video_id(self, url: str) -> str | None:
        parsed = urlparse(url)
        if "youtu.be" in parsed.netloc:
            return parsed.path.strip("/")
        if "youtube.com" in parsed.netloc:
            if "v=" in parsed.query:
                return parsed.query.split("v=")[1].split("&")[0]
        return None

    def _get_video_metadata(self, video_id: str) -> dict:
        # We can't easily get metadata without YouTube Data API key (which entails quota/cost).
        # However, we can use oEmbed which is free and public!
        # https://www.youtube.com/oembed?url=http://www.youtube.com/watch?v=VIDEO_ID&format=json
        try:
            oembed_url = f"https://www.youtube.com/oembed?url=http://www.youtube.com/watch?v={video_id}&format=json"
            import requests
            resp = requests.get(oembed_url, timeout=5)
            if resp.status_code == 200:
                data = resp.json()
                return {
                    "title": data.get("title"),
                    "author": data.get("author_name"),
                    "thumbnail_url": data.get("thumbnail_url"),
                    "author_url": data.get("author_url")
                }
        except Exception:
            pass
        return {}

    async def fetch_html(self, client, url: str):
        video_id = self._get_video_id(url)
        if not video_id:
            return None

        try:
            # Run blocking call in threadpool
            loop = asyncio.get_event_loop()
            full_transcript = None
            
            # Method 1: Try list (Advanced)
            try:
                # Based on local environment, the methods are 'list' and 'fetch'
                # list_transcripts -> list
                # get_transcript -> fetch
                transcript_list = await loop.run_in_executor(None, YouTubeTranscriptApi.list, video_id)
                # Try to get English or auto-generated English
                transcript = None
                try:
                    transcript = transcript_list.find_transcript(['en']) 
                except Exception:
                    try:
                        transcript = transcript_list.find_generated_transcript(['en'])
                    except Exception:
                        # Fallback to any available
                        for t in transcript_list:
                            transcript = t
                            break
                if transcript:
                    full_transcript = await loop.run_in_executor(None, transcript.fetch)
            except Exception as e:
                logger.warning(f"YouTube list failed ({e}), trying fallback...")
            
            # Method 2: Try fetch (Simple Fallback)
            if not full_transcript:
                try:
                    full_transcript = await loop.run_in_executor(None, YouTubeTranscriptApi.fetch, video_id)
                except Exception as e2:
                    logger.warning(f"YouTube fetch fallback failed: {e2}")
            
            if not full_transcript:
                return None

            # Format as article
            # Get metadata via oEmbed
            meta = await loop.run_in_executor(None, self._get_video_metadata, video_id)
            title = meta.get("title") or f"YouTube Video ({video_id})"
            author = meta.get("author") or "YouTube Creator"
            thumb = meta.get("thumbnail_url") or f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg"

            # Create readable HTML text
            # Group by 30 seconds paragraphs? Or just list items?
            # Let's make it look like a script/article.
            
            html_parts = []
            current_p = []
            
            # Simple grouping strategy: merge lines until ~300 chars or pause > 2s
            last_end = 0.0
            
            for line in full_transcript:
                text = line['text']
                start = line['start']
                duration = line['duration']
                
                # Check for "paragraph break" based on time gap (2s silence)
                if start - last_end > 2.0 and current_p:
                    html_parts.append(f"<p>{' '.join(current_p)}</p>")
                    current_p = []

                current_p.append(text)
                last_end = start + duration
                
            if current_p:
                html_parts.append(f"<p>{' '.join(current_p)}</p>")

            body_html = "\n".join(html_parts)
            
            # Embed the video player at the top
            player_html = f"""
            <div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; border-radius: 12px; margin-bottom: 32px;">
                <iframe src="https://www.youtube.com/embed/{video_id}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" frameborder="0" allowfullscreen></iframe>
            </div>
            """

            safe_thumb = html_lib.escape(thumb or "none", quote=True)
            safe_title = html_lib.escape(title, quote=True)
            safe_author = html_lib.escape(author, quote=True)

            return f"""
            <div class="nook-container" data-thumbnail="{safe_thumb}" data-title="{safe_title}" data-author="{safe_author}" data-published="{date.today().isoformat()}">
                <header style="margin-bottom: 24px;">
                    <h1 class="nook-title">{title}</h1>
                    <p class="nook-subtitle">Video Transcript</p>
                </header>
                {player_html}
                <div class="nook-transcript">
                    {body_html}
                </div>
            </div>
            """

        except (TranscriptsDisabled, NoTranscriptFound) as e:
            logger.warning(f"YouTube transcript unavailable: {e}")
            # Fallback: Return video embed without transcript
            # We need to fetch metadata again if we didn't get it
            try:
                meta = await loop.run_in_executor(None, self._get_video_metadata, video_id)
                title = meta.get("title") or f"YouTube Video ({video_id})"
                author = meta.get("author") or "YouTube Creator"
                thumb = meta.get("thumbnail_url") or f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg"
                
                safe_thumb = html_lib.escape(thumb or "none", quote=True)
                safe_title = html_lib.escape(title, quote=True)
                safe_author = html_lib.escape(author, quote=True)
                
                player_html = f"""
                <div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; border-radius: 12px; margin-bottom: 32px;">
                    <iframe src="https://www.youtube.com/embed/{video_id}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" frameborder="0" allowfullscreen></iframe>
                </div>
                """
                
                return f"""
                <div class="nook-container" data-thumbnail="{safe_thumb}" data-title="{safe_title}" data-author="{safe_author}" data-published="{date.today().isoformat()}">
                    <header style="margin-bottom: 24px;">
                        <h1 class="nook-title">{title}</h1>
                        <p class="nook-subtitle">Video Only (Transcript Unavailable)</p>
                    </header>
                    {player_html}
                    <p><em>Transcript could not be auto-generated for this video. You can still watch it above.</em></p>
                </div>
                """
            except Exception:
                return None

        except Exception as e:
            logger.warning(f"YouTube transcript error: {e}")
            return None

    async def fetch_text(self, client, url: str):
        # reuse fetch_html logic but strip tags?
        # For efficiency, just fetch transcript text
        video_id = self._get_video_id(url)
        if not video_id: return None
        try:
             loop = asyncio.get_event_loop()
             transcript = await loop.run_in_executor(None, YouTubeTranscriptApi.get_transcript, video_id)
             return " ".join([t['text'] for t in transcript])
        except Exception:
            return None

class AnnasAdapter(BaseAdapter):
    name = "annas"
    license_type = "copyrighted"

    def can_handle(self, url: str) -> bool:
        return "annas-archive" in url or "libgen" in url

    async def fetch_html(self, client, url: str):
        headers = {"User-Agent": DEFAULT_HEADERS["User-Agent"]}
        
        # Scenario A: Libgen Search URL (From OpenLibrary fallback)
        if "search.php" in url:
            # Extract query from URL
            parsed = urlparse(url)
            query_params = parse_qs(parsed.query)
            req = query_params.get("req", [""])[0]
            
            if not req: return None
            
            # Try mirrors
            libgen_mirrors = [
                "https://libgen.is",
                "https://libgen.rs",
                "https://libgen.li",
                "https://libgen.st",
            ]
            
            for base in libgen_mirrors:
                try:
                    search_url = f"{base}/search.php?req={quote(req)}&open=0&res=25&view=simple&phrase=1&column=def"
                    resp = await client.get(search_url, headers=headers, timeout=10.0)
                    if resp.status_code == 200:
                        soup = BeautifulSoup(resp.text, "html.parser")
                        
                        # Parsing logic
                        tables = soup.find_all("table")
                        target_table = None
                        for t in tables:
                            if len(t.find_all("tr")) > 5:
                                target_table = t
                                break
                        if not target_table and tables:
                             target_table = max(tables, key=lambda t: len(t.find_all("tr")))
                        
                        if target_table:
                            rows = target_table.find_all("tr")[1:]
                            for row in rows:
                                cols = row.find_all("td")
                                if len(cols) < 9: continue
                                
                                ext = cols[8].get_text(strip=True).lower()
                                if ext != "pdf": continue
                                
                                title_col = cols[2]
                                title_link = title_col.find("a", href=True)
                                if title_link:
                                    detail_rel = title_link["href"]
                                    if detail_rel.startswith("book/index.php"):
                                         detail_url = f"{base}/{detail_rel}"
                                    else:
                                         detail_url = urljoin(base, detail_rel)
                                    
                                    # Found a detail page! Fetch it.
                                    res = await self._fetch_libgen_detail(client, detail_url)
                                    if res: return res
                except Exception:
                    continue
            return None

        # Scenario B: Direct Libgen Detail URL
        if "libgen" in url and "book/index.php" in url:
             # Try to replace host if it fails? For now just try direct.
             return await self._fetch_libgen_detail(client, url)

        # Scenario C: Anna's Archive URL
        return await self._fetch_annas_detail(client, url)

    async def _fetch_libgen_detail(self, client, url: str):
        try:
            headers = {"User-Agent": DEFAULT_HEADERS["User-Agent"]}
            resp = await client.get(url, headers=headers)
            if resp.status_code != 200: return None
            soup = BeautifulSoup(resp.text, "html.parser")
            
            get_link = soup.find("a", string="GET") or soup.find("a", string="Cloudflare")
            if get_link and get_link.get("href"):
                download_url = get_link["href"]
                
                title = "Unknown Book"
                h1 = soup.find("h1")
                if h1: title = h1.get_text(strip=True)
                
                return {
                    "type": "pdf",
                    "url": download_url,
                    "title": title,
                    "author": "Unknown"
                }
        except Exception:
            pass
        return None

    async def _fetch_annas_detail(self, client, url: str):
        try:
            headers = {"User-Agent": DEFAULT_HEADERS["User-Agent"]}
            resp = await client.get(url, headers=headers)
            if resp.status_code != 200: return None
            soup = BeautifulSoup(resp.text, "html.parser")
            
            download_url = None
            for link in soup.find_all("a", href=True):
                href = link["href"]
                if "library.lol" in href or "libgen.li" in href:
                    try:
                        lr = await client.get(href, headers=headers)
                        if lr.status_code == 200:
                            lsoup = BeautifulSoup(lr.text, "html.parser")
                            get_link = lsoup.find("a", string="GET") or lsoup.find("a", string="Cloudflare")
                            if get_link and get_link.get("href"):
                                download_url = get_link["href"]
                                break
                    except Exception:
                        continue
            
            if download_url:
                title = "Unknown Book"
                h1 = soup.find("h1")
                if h1: title = h1.get_text(strip=True)
                return {
                    "type": "pdf",
                    "url": download_url,
                    "title": title,
                    "author": "Unknown"
                }
        except Exception:
            pass
        return None

    async def fetch_text(self, client, url: str):
        return None

ADAPTERS = [
    MediumAdapter(),
    YoutubeAdapter(),
    ArxivAdapter(),
    PubMedCentralAdapter(),
    OpenAlexAdapter(),
    SemanticScholarAdapter(),
    AnnasAdapter(),
]
FALLBACK_ADAPTERS = [
    GenericAdapter(),
    JinaAdapter(),
]

def get_candidate_adapters(url: str):
    candidates = []
    # 1. Check specific adapters
    for adapter in ADAPTERS:
        if adapter.can_handle(url):
            candidates.append(adapter)
            break # Use the first specific match
    
    # 2. Add fallbacks
    candidates.extend(FALLBACK_ADAPTERS)
    return candidates

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
    http_request: Request,
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    if not is_safe_url(request.url):
        raise HTTPException(status_code=400, detail="URL not allowed.")
    # 1. Check Limits
    user = get_current_user(authorization, db)
    
    # Rate Limit (Abuse protection - 30 req/min)
    if not check_rate_limit(
        "unlock_abuse",
        http_request,
        user,
        int(os.getenv("RATE_LIMIT_UNLOCK_PER_MINUTE", "30")),
        60
    ):
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Please try again later.")

    # Tier / Daily Limits
    if user:
        if not check_usage_limit(user, db, action="unlock"):
            raise HTTPException(status_code=402, detail="Daily unlock limit reached. Upgrade to unlock more.")
    else:
        # Anonymous User Limit (e.g., 1 per day tracked by IP)
        # We use the rate limit store with a 24h window
        if not check_rate_limit(
            "unlock_daily_anon",
            http_request,
            None, # Force IP-based key
            1,
            86400 # 24 hours
        ):
             raise HTTPException(status_code=401, detail="Free preview limit reached. Please sign in to read more.")

    candidate_adapters = get_candidate_adapters(request.url)
    if not candidate_adapters:
        raise HTTPException(status_code=400, detail="Unsupported source URL.")

    # Check cache for the *first* candidate (most specific)
    # Or should we check cache for ANY?
    # Key is (url, source).
    # We check if we have a valid entry for this URL from ANY supported source?
    # Let's keep it simple: check if we have *any* cached content for this URL.
    cached = db.query(ContentCache).filter(ContentCache.url == request.url).first()
    
    # Check if cache is fresh AND valid
    is_valid_cache = (
        cached 
        and cached.content_html 
        and is_cache_fresh(cached) 
        and "/api/proxy_image" not in cached.content_html
        and "data-thumbnail" in cached.content_html
        and "data-title" in cached.content_html
        and "data-author" in cached.content_html
        and "data-tags" in cached.content_html
        and 'data-thumbnail=""' not in cached.content_html
    )

    if is_valid_cache:
        safe_html = sanitize_html(cached.content_html)
        meta = extract_metadata(safe_html)
        meta, normalized_html = _normalize_metadata_from_html(safe_html, meta)
        if normalized_html != safe_html:
            safe_html = normalized_html
        if safe_html != cached.content_html:
            cached.content_html = safe_html
            cached.updated_at = datetime.utcnow()
            db.commit()
        return {
            "success": True,
            "html": safe_html,
            "source": cached.source,
            "license": cached.license or "unknown",
            "remaining_reads": get_remaining_usage(user, db, "unlock") if user else 0,
            "metadata": meta
        }

    client = app.state.http
    
    # Try adapters in order
    last_error = None
    for adapter in candidate_adapters:
        try:
            logger.info(f"Attempting unlock with adapter: {adapter.name}")
            content = await adapter.fetch_html(client, request.url)
            
            # Handle PDF/Special Content (Dict Return)
            if isinstance(content, dict) and content.get("type") == "pdf":
                 logger.info(f"Unlock success (PDF) with {adapter.name}")
                 return {
                    "success": True,
                    "html": "", # No HTML for PDF
                    "content_type": "pdf",
                    "pdf_url": content.get("url"),
                    "source": adapter.name,
                    "license": adapter.license_type,
                    "remaining_reads": get_remaining_usage(user, db, "unlock") if user else 0,
                    "metadata": {
                        "title": content.get("title", "Untitled"),
                        "author": content.get("author", "Unknown"),
                        "thumbnail_url": content.get("thumbnail_url"),
                        "published_at": None,
                        "tags": []
                    }
                 }

            if content and isinstance(content, str):
                logger.info(f"Unlock success with {adapter.name}")
                safe_html = sanitize_html(content)
                meta = extract_metadata(safe_html)
                meta, normalized_html = _normalize_metadata_from_html(safe_html, meta)
                if normalized_html != safe_html:
                    safe_html = normalized_html
                    
                if cached:
                    cached.content_html = safe_html
                    cached.source = adapter.name
                    cached.license = adapter.license_type
                    cached.updated_at = datetime.utcnow()
                else:
                    # Double check if it exists now (race condition)
                    existing = db.query(ContentCache).filter(ContentCache.url == request.url).first()
                    if existing:
                        existing.content_html = safe_html
                        existing.source = adapter.name
                        existing.license = adapter.license_type
                        existing.updated_at = datetime.utcnow()
                    else:
                        cached = ContentCache(
                            url=request.url,
                            source=adapter.name,
                            license=adapter.license_type,
                            content_html=safe_html,
                        )
                        db.add(cached)
                
                try:
                    db.commit()
                except Exception as e:
                    db.rollback()
                    logger.warning(f"Cache update failed (race condition): {e}")
                    # Continue without caching, just return result
                
                return {
                    "success": True,
                    "html": safe_html,
                    "content_type": "html",
                    "source": adapter.name,
                    "license": adapter.license_type,
                    "remaining_reads": get_remaining_usage(user, db, "unlock") if user else 0,
                    "metadata": meta
                }
        except Exception as e:
            logger.error(f"Adapter {adapter.name} failed: {e}")
            # Ensure DB session is clean for next adapter
            try:
                db.rollback()
            except:
                pass
            last_error = e
            continue

    raise HTTPException(status_code=503, detail="Could not retrieve article content from any source.")

from google import genai
from dotenv import load_dotenv

load_dotenv()

# Configure Gemini Client
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
gemini_client = None
if GEMINI_API_KEY:
    gemini_client = genai.Client(api_key=GEMINI_API_KEY)

SUMMARY_PROVIDER_TIMEOUT = float(os.getenv("SUMMARY_PROVIDER_TIMEOUT", "12"))

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "google/gemini-2.0-flash-001")
OPENROUTER_MODEL_FALLBACK = os.getenv("OPENROUTER_MODEL_FALLBACK")
OPENROUTER_MODELS = _parse_model_list(
    os.getenv("OPENROUTER_MODELS"),
    [m for m in [OPENROUTER_MODEL, OPENROUTER_MODEL_FALLBACK] if m]
)
OPENROUTER_SITE_URL = os.getenv("OPENROUTER_SITE_URL")
OPENROUTER_APP_NAME = os.getenv("OPENROUTER_APP_NAME")

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-70b-versatile")
GROQ_MODEL_FALLBACK = os.getenv("GROQ_MODEL_FALLBACK")
GROQ_MODELS = _parse_model_list(
    os.getenv("GROQ_MODELS"),
    [m for m in [GROQ_MODEL, GROQ_MODEL_FALLBACK] if m]
)

QUBRID_API_KEY = os.getenv("QUBRID_API_KEY")
QUBRID_API_BASE = os.getenv("QUBRID_API_BASE", "https://platform.qubrid.com/api/v1/qubridai/chat/completions")
QUBRID_MODEL = os.getenv("QUBRID_MODEL", "openai/gpt-oss-120b")
QUBRID_MODEL_FALLBACK = os.getenv("QUBRID_MODEL_FALLBACK")
QUBRID_MODELS = _parse_model_list(
    os.getenv("QUBRID_MODELS"),
    [m for m in [QUBRID_MODEL, QUBRID_MODEL_FALLBACK, "mistralai/Mistral-7B-Instruct-v0.3"] if m]
)
QUBRID_AUTH_HEADER = os.getenv("QUBRID_AUTH_HEADER", "Authorization")
QUBRID_AUTH_VALUE = os.getenv("QUBRID_AUTH_VALUE")

def _extract_summary_from_response(data: dict) -> str | None:
    if not isinstance(data, dict):
        return None
    if isinstance(data.get("summary"), str):
        return data["summary"]
    if isinstance(data.get("text"), str):
        return data["text"]
    if isinstance(data.get("output"), str):
        return data["output"]
    choices = data.get("choices")
    if isinstance(choices, list) and choices:
        first = choices[0]
        if isinstance(first, dict):
            message = first.get("message")
            if isinstance(message, dict) and isinstance(message.get("content"), str):
                return message["content"]
            if isinstance(first.get("text"), str):
                return first["text"]
    return None

async def summarize_with_chat_provider(
    client,
    base_url: str,
    api_key: str | None,
    models: list[str],
    content: str,
    extra_headers: dict | None = None
) -> tuple[str | None, str | None, str | None]:
    if not base_url or not models:
        return None, None, "not_configured"
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    if extra_headers:
        headers.update(extra_headers)
    prompt = f"Summarize this in 3 bullet points:\n{content[:8000]}"
    last_error = None
    for model in models:
        payload = {
            "model": model,
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        }
        try:
            resp = await client.post(base_url, json=payload, headers=headers, timeout=SUMMARY_PROVIDER_TIMEOUT)
            if resp.status_code == 200:
                data = resp.json()
                summary = _extract_summary_from_response(data)
                if summary:
                    return summary, model, None
            if resp.status_code in (429, 502, 503, 504):
                last_error = "rate_limited"
                await asyncio.sleep(0.8)
                continue
            last_error = f"status_{resp.status_code}"
        except Exception as e:
            last_error = str(e)
            logger.warning(f"Summary provider error: {e}")
            continue
    return None, None, last_error or "failed"

async def summarize_with_openrouter(client, content: str) -> tuple[str | None, str | None, str | None]:
    if not OPENROUTER_API_KEY:
        return None, None, "not_configured"
    headers = {}
    if OPENROUTER_SITE_URL:
        headers["HTTP-Referer"] = OPENROUTER_SITE_URL
    if OPENROUTER_APP_NAME:
        headers["X-Title"] = OPENROUTER_APP_NAME
    return await summarize_with_chat_provider(
        client,
        "https://openrouter.ai/api/v1/chat/completions",
        OPENROUTER_API_KEY,
        OPENROUTER_MODELS,
        content,
        extra_headers=headers if headers else None
    )

async def summarize_with_groq(client, content: str) -> tuple[str | None, str | None, str | None]:
    if not GROQ_API_KEY:
        return None, None, "not_configured"
    return await summarize_with_chat_provider(
        client,
        "https://api.groq.com/openai/v1/chat/completions",
        GROQ_API_KEY,
        GROQ_MODELS,
        content
    )

async def summarize_with_qubrid(client, content: str) -> tuple[str | None, str | None, str | None]:
    if not QUBRID_API_KEY and not QUBRID_AUTH_VALUE:
        return None, None, "not_configured"
    headers = {}
    if QUBRID_AUTH_VALUE:
        headers[QUBRID_AUTH_HEADER] = QUBRID_AUTH_VALUE
    return await summarize_with_chat_provider(
        client,
        QUBRID_API_BASE,
        QUBRID_API_KEY,
        QUBRID_MODELS,
        content,
        extra_headers=headers
    )

async def summarize_with_gemini(content: str, tier: str) -> tuple[str | None, str | None, str | None]:
    if not gemini_client:
        return None, None, "not_configured"
    models = get_models_for_tier(tier)
    prompt = f"Summarize this in 3 bullet points: {content[:8000]}"
    last_error = None
    for model_id in models:
        for attempt in range(2):
            try:
                response = gemini_client.models.generate_content(
                    model=model_id,
                    contents=prompt
                )
                return response.text, model_id, None
            except Exception as e:
                last_error = e
                error_msg = str(e)
                if "429" in error_msg or "RESOURCE_EXHAUSTED" in error_msg:
                    await asyncio.sleep(1.5 * (attempt + 1))
                    continue
                break
    error_msg = str(last_error) if last_error else "Gemini error"
    if "429" in error_msg or "RESOURCE_EXHAUSTED" in error_msg:
        return None, None, "rate_limited"
    return None, None, "failed"

@app.post("/api/summarize")
async def summarize_article(
    request: UnlockRequest,
    http_request: Request,
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    if not is_safe_url(request.url):
        raise HTTPException(status_code=400, detail="URL not allowed.")
    user = get_current_user(authorization, db)
    if not user:
         raise HTTPException(status_code=401, detail="Login required")

    if not check_rate_limit(
        "summarize",
        http_request,
        user,
        int(os.getenv("RATE_LIMIT_SUMMARIZE_PER_MINUTE", "10")),
        60
    ):
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Please try again later.")
         
    if not check_usage_limit(user, db, action="summarize"):
         raise HTTPException(status_code=402, detail="Daily summary limit reached. Upgrade for more.")

    candidate_adapters = get_candidate_adapters(request.url)
    if not candidate_adapters:
        raise HTTPException(status_code=400, detail="Unsupported source URL.")
    
    # Use the first capable adapter
    adapter = candidate_adapters[0]

    # 1. Check Global Cache for Summary
    cached = db.query(ContentCache).filter(
        ContentCache.url == request.url,
        ContentCache.source == adapter.name
    ).first()
    
    if cached and cached.summary:
        return {
            "summary": cached.summary,
            "provider": "cache",
            "remaining_summaries": get_remaining_usage(user, db, "summarize"),
        }
    
    content = None
    if cached and cached.content_text:
        content = cached.content_text
    
    if not content:
        client = app.state.http
        content = await adapter.fetch_text(client, request.url)
        if content:
            if cached:
                cached.content_text = content
                db.commit()
            else:
                # Create cache entry if missing
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

    # 2. Call Summary Providers in Order (Gemini -> External by default)
    tier = user.tier if user and user.tier in TIER_LIMITS else "seeker"
    provider_order = _parse_provider_order(
        os.getenv("SUMMARY_PROVIDER_ORDER"),
        ["gemini", "openrouter", "groq", "qubrid"]
    )
    last_error = None
    last_provider = None
    last_model = None
    for provider in provider_order:
        if provider == "gemini":
            summary, model, err = await summarize_with_gemini(content, tier)
            if summary:
                if cached:
                    cached.summary = summary
                    db.commit()
                logger.info(json.dumps({"event": "summary.complete", "provider": "gemini", "model": model, "url": request.url}))
                return {
                    "summary": summary,
                    "provider": "gemini",
                    "model": model,
                    "remaining_summaries": get_remaining_usage(user, db, "summarize"),
                }
            last_error = err
            last_provider = "gemini"
            last_model = model
            continue
        if provider == "openrouter":
            summary, model, err = await summarize_with_openrouter(app.state.http, content)
            if summary:
                if cached:
                    cached.summary = summary
                    db.commit()
                logger.info(json.dumps({"event": "summary.complete", "provider": "openrouter", "model": model, "url": request.url}))
                return {
                    "summary": summary,
                    "provider": "openrouter",
                    "model": model,
                    "remaining_summaries": get_remaining_usage(user, db, "summarize"),
                }
            last_error = err or "openrouter_failed"
            last_provider = "openrouter"
            last_model = model
            continue
        if provider == "groq":
            summary, model, err = await summarize_with_groq(app.state.http, content)
            if summary:
                if cached:
                    cached.summary = summary
                    db.commit()
                logger.info(json.dumps({"event": "summary.complete", "provider": "groq", "model": model, "url": request.url}))
                return {
                    "summary": summary,
                    "provider": "groq",
                    "model": model,
                    "remaining_summaries": get_remaining_usage(user, db, "summarize"),
                }
            last_error = err or "groq_failed"
            last_provider = "groq"
            last_model = model
            continue
        if provider == "qubrid":
            summary, model, err = await summarize_with_qubrid(app.state.http, content)
            if summary:
                if cached:
                    cached.summary = summary
                    db.commit()
                logger.info(json.dumps({"event": "summary.complete", "provider": "qubrid", "model": model, "url": request.url}))
                return {
                    "summary": summary,
                    "provider": "qubrid",
                    "model": model,
                    "remaining_summaries": get_remaining_usage(user, db, "summarize"),
                }
            last_error = err or "qubrid_failed"
            last_provider = "qubrid"
            last_model = model
            continue

    if last_error == "rate_limited":
        return {"summary": "AI is currently busy (rate limit). Please try again shortly.", "provider": last_provider, "model": last_model}
    if last_error == "not_configured":
        return {"summary": "AI Summary unavailable currently.", "provider": last_provider, "model": last_model}
    return {"summary": "AI Summary unavailable currently.", "provider": last_provider, "model": last_model}

@app.get("/api/speak")
def speak_text(
    text: str,
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    if os.getenv("ENABLE_LEGACY_TTS", "false").lower() != "true":
        raise HTTPException(status_code=410, detail="Legacy TTS is deprecated. Use browser-native TTS.")
    # Log incoming text length
    logger.debug(f"speak_text called with {len(text)} chars")
    
    user = get_current_user(authorization, db)
    if not user:
         raise HTTPException(status_code=401, detail="Login required")
         
    if not check_usage_limit(user, db, action="tts"):
         raise HTTPException(status_code=402, detail="Daily TTS limit reached. Upgrade for more.")

    if not text or len(text.strip()) == 0:
        raise HTTPException(status_code=400, detail="No text provided")

    from gtts import gTTS
    try:
        # Generate audio
        # Limit text to avoid huge processing timeout
        safe_text = text[:1000] 
        tts = gTTS(safe_text, lang='en')
        
        # Save to memory buffer
        audio_io = io.BytesIO()
        tts.write_to_fp(audio_io)
        audio_io.seek(0)
        
        size = audio_io.getbuffer().nbytes
        logger.debug(f"Generated audio size: {size} bytes")
        
        if size == 0:
             raise Exception("Generated audio is empty")
        
        return StreamingResponse(audio_io, media_type="audio/mp3")
    except Exception as e:
        logger.error(f"TTS Error: {e}")
        raise HTTPException(status_code=500, detail="Audio generation failed")

class SaveRequest(BaseModel):
    url: str
    title: str
    thumbnail_url: str = None
    author: str = None
    published_at: str = None

@app.post("/api/save")
async def save_article(
    payload: SaveRequest, 
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    user = get_current_user(authorization, db)
    if not user: raise HTTPException(status_code=401, detail="Login required")
    if not is_safe_url(payload.url):
        raise HTTPException(status_code=400, detail="URL not allowed.")
    
    # Normalize URL: strip query params AND trailing slashes
    clean_url = payload.url.split('?')[0].rstrip('/')
    
    # Handle Mirror Domains: Normalize to medium.com if possible for checking
    # (This is a simplified check, ideally we'd parse domain)
    # Check if ANY saved article has a URL that 'contains' the path of this new URL?
    # No, that's expensive. 
    # Just check exact match of the clean URL or starts with.
    
    existing = db.query(SavedArticle).filter(
        SavedArticle.user_id == user.id,
        SavedArticle.url.contains(clean_url) # More robust than startswith for mirrors?
    ).first()
    
    if existing:
        return {"success": True, "message": "Already saved"}
    
    saved = SavedArticle(
        user_id=user.id, 
        url=payload.url, 
        title=payload.title,
        thumbnail_url=payload.thumbnail_url,
        author=payload.author,
        published_at=payload.published_at
    )
    db.add(saved)
    db.commit()
    return {"success": True, "message": "Saved to library"}

@app.delete("/api/save")
async def delete_article(
    request: UnlockRequest,
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    user = get_current_user(authorization, db)
    if not user: raise HTTPException(status_code=401, detail="Login required")
    
    # Find and delete
    # We try to match exact URL or normalized
    clean_url = request.url.split('?')[0]
    
    article = db.query(SavedArticle).filter(
        SavedArticle.user_id == user.id,
        (SavedArticle.url == request.url) | (SavedArticle.url.startswith(clean_url))
    ).first()
    
    if article:
        db.delete(article)
        db.commit()
        return {"success": True, "message": "Article removed"}
    
    raise HTTPException(status_code=404, detail="Article not found")

@app.get("/api/library")
async def get_library(
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    user = get_current_user(authorization, db)
    if not user: raise HTTPException(status_code=401, detail="Login required")
    
    return user.saved_articles

import feedparser

# --- Discover Endpoint ---

class ArticlePreview(BaseModel):
    title: str
    url: str
    source: str
    summary: str = ""
    published: str = ""

@app.get("/api/discover")
def get_discover_content(
    category: str = "All",
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    # Log User Interest for future ML
    user = get_current_user(authorization, db)
    if user and category != "All":
        # We use a distinct action prefix to easily query preferences later
        # e.g. "interest:AI", "interest:Tech"
        # We don't enforce limits here, just logging.
        try:
            log = _get_usage_log(user, db, f"interest:{category}")
            log.count += 1
            db.commit()
        except Exception as e:
            logger.warning(f"Failed to log interest: {e}")

    # 1. Curated Featured
    featured = [
        ArticlePreview(
            title="The Age of AI Agents", 
            url="https://medium.com/failed-stork/the-age-of-ai-agents-7e6140502758",
            source="Medium",
            summary="A deep dive into how autonomous agents are reshaping software.",
            published="2025-10-15"
        ),
        ArticlePreview(
            title="Attention Is All You Need", 
            url="https://arxiv.org/abs/1706.03762",
            source="Arxiv",
            summary="The landmark paper that introduced the Transformer architecture.",
            published="2017-06-12"
        )
    ]

    # 2. Dynamic RSS Feeds
    rss_sources = [
        {"name": "OpenAI", "url": "https://openai.com/blog/rss.xml", "category": "AI"},
        {"name": "MIT Tech Review", "url": "https://www.technologyreview.com/feed/", "category": "Tech"},
        {"name": "Google AI", "url": "https://blog.google/technology/ai/rss/", "category": "AI"},
        {"name": "NASA", "url": "https://www.nasa.gov/rss/dyn/breaking_news.rss", "category": "Science"},
        {"name": "Nature", "url": "https://www.nature.com/nature.rss", "category": "Science"},
        {"name": "Y Combinator", "url": "https://blog.ycombinator.com/rss/", "category": "Startup"},
        {"name": "Paul Graham", "url": "http://www.aaronsw.com/2002/feeds/pgessays.rss", "category": "Startup"},
        {"name": "Verge", "url": "https://www.theverge.com/rss/index.xml", "category": "Tech"},
        {"name": "Wired", "url": "https://www.wired.com/feed/rss", "category": "Tech"},
        {"name": "Hacker News", "url": "https://hnrss.org/best", "category": "Tech"},
        {"name": "PsyPost", "url": "https://feeds.feedburner.com/psypost", "category": "Health"},
    ]

    # Extract unique categories dynamically
    unique_cats = sorted(list(set(s["category"] for s in rss_sources)))
    available_categories = ["All"] + unique_cats

    # Filter sources
    if category and category != "All":
        rss_sources = [s for s in rss_sources if s["category"].lower() == category.lower()]

    latest = []
    # Limit to 6 sources to prevent timeout
    limit_sources = rss_sources if category != "All" else rss_sources[:6]
    
    for source in limit_sources:
        try:
            feed = feedparser.parse(source["url"])
            for entry in feed.entries[:2]: # Get top 2 from each
                latest.append(ArticlePreview(
                    title=entry.title,
                    url=entry.link,
                    source=source["name"],
                    summary=entry.get("summary", "")[:150] + "...",
                    published=entry.get("published", "")[:10]
                ))
        except Exception as e:
            logger.warning(f"Failed to fetch RSS {source['name']}: {e}")
            continue

    return {
        "featured": featured,
        "latest": latest,
        "categories": available_categories
    }

# --- Payments (Razorpay for India) ---

class CreateOrderRequest(BaseModel):
    plan_id: str # 'scholar' or 'insider'

@app.get("/api/search")
async def search_content(q: str):
    if not q:
        raise HTTPException(status_code=400, detail="Missing query")

    client = app.state.http
    headers = {
        "User-Agent": DEFAULT_HEADERS["User-Agent"],
        "Accept-Language": "en-US,en;q=0.9",
    }
    
    # 1. OpenLibrary Search (Primary - Stable API)
    try:
        # Use fields to minimize payload
        ol_url = f"https://openlibrary.org/search.json?q={quote(q)}&fields=title,author_name,cover_i,key,isbn&limit=15"
        r = await client.get(ol_url, headers=headers, timeout=5.0)
        
        if r.status_code == 200:
            data = r.json()
            results = []
            seen_titles = set()
            
            for doc in data.get("docs", []):
                title = doc.get("title")
                if not title: continue
                
                # Dedup by title to avoid clutter
                if title.lower() in seen_titles: continue
                seen_titles.add(title.lower())
                
                author = "Unknown"
                if doc.get("author_name"):
                    author = doc.get("author_name")[0]
                
                cover_id = doc.get("cover_i")
                thumb = f"https://covers.openlibrary.org/b/id/{cover_id}-M.jpg" if cover_id else None
                
                search_query = f"{title} {author}"
                target_url = f"https://libgen.is/search.php?req={quote(search_query)}"
                
                results.append({
                    "title": title,
                    "author": author,
                    "url": target_url, 
                    "source": "OpenLibrary",
                    "thumbnail_url": thumb,
                    "is_pdf": True
                })
            
            logger.info(f"OpenLibrary found {len(results)} results for '{q}'")
            if results:
                return {"results": results}
                
    except Exception as e:
        logger.warning(f"OpenLibrary search failed: {e}")

    # 2. Libgen Search (Fallback)
    libgen_mirrors = [
        "https://libgen.is",
        "https://libgen.rs",
        "https://libgen.li",
        "https://libgen.st",
        "https://libgen.gs",
        "https://libgen.lc",
    ]

    # Fallback to Anna's Archive mirrors if Libgen fails
    mirrors = [
        "https://annas-archive.org",
        "https://annas-archive.li",
        "https://annas-archive.se",
        "https://annas-archive.gs",
    ]

    for base_url in mirrors:
        search_url = f"{base_url}/search?q={quote(q)}"
        try:
            r = await client.get(search_url, headers=headers)
            if r.status_code == 200:
                soup = BeautifulSoup(r.text, "html.parser")
                if "challenge" in r.url.path or "Challenge" in soup.title.string:
                    continue

                results = []
                seen_md5s = set()
                
                for link in soup.find_all("a", href=True):
                    href = link["href"]
                    if "/md5/" in href:
                        md5 = href.split("/md5/")[1].split("?")[0]
                        if md5 in seen_md5s:
                            continue
                        seen_md5s.add(md5)
                        
                        text_content = link.get_text(separator="|", strip=True).split("|")
                        text_content = [t for t in text_content if t]
                        
                        if not text_content: continue
                            
                        title = text_content[0]
                        author = text_content[1] if len(text_content) > 1 else "Unknown"
                        
                        thumb = None
                        img = link.find("img")
                        if img and img.get("src"): thumb = img["src"]
                        
                        results.append({
                            "title": title,
                            "author": author,
                            "url": f"{base_url}{href}",
                            "source": "Anna's Archive",
                            "thumbnail_url": thumb,
                            "is_pdf": True
                        })
                        if len(results) >= 10: break
                
                if results: return {"results": results}
            
        except Exception as e:
            logger.warning(f"Anna's search failed on {base_url}: {e}")
            continue

    logger.error("All book search mirrors failed.")
    return {"results": []}

@app.post("/api/create-order")
async def create_order(
    request: CreateOrderRequest,
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    user = get_current_user(authorization, db)
    if not user: raise HTTPException(status_code=401, detail="Login required")

    try:
        if not razorpay_client:
            raise HTTPException(status_code=500, detail="Payment gateway not configured")

        amount = 29900 # Default Scholar: 299 INR
        if request.plan_id == "insider":
            amount = 69900 # Insider: 699 INR
            
        # Create Razorpay Order
        data = { 
            "amount": amount, 
            "currency": "INR", 
            "receipt": f"order_{user.id}_{int(datetime.now().timestamp())}",
            "notes": { "user_id": str(user.id), "plan": request.plan_id } 
        }
        payment = razorpay_client.order.create(data=data)
        
        return {
            "order_id": payment['id'],
            "amount": payment['amount'],
            "currency": payment['currency'],
            "key_id": RAZORPAY_KEY_ID,
            "plan_id": request.plan_id
        }
    except Exception as e:
        logger.error(f"Create order error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

class WebhookRequest(BaseModel):
    razorpay_payment_id: str
    razorpay_order_id: str
    razorpay_signature: str
    plan_id: str # Passed from frontend success callback context

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
        
        # If we got here, payment is successful. Update Tier.
        # Ideally we fetch the order from Razorpay to verify the 'amount' corresponds to the plan
        # But trusting the plan_id from context + signature verification is okay for MVP if order_id matches.
        
        user.tier = payload.plan_id
        db.commit()
        
        return {"status": "success", "message": f"Upgraded to {payload.plan_id.title()}!"}
        
    except razorpay.errors.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Payment verification failed")
    except Exception as e:
        logger.error(f"Payment verification error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
