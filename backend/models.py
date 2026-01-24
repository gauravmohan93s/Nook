from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, create_engine, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    tier = Column(String, default="seeker") # seeker (free), insider, patron
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    saved_articles = relationship("SavedArticle", back_populates="user")
    usage_logs = relationship("UsageLog", back_populates="user")

class SavedArticle(Base):
    __tablename__ = "saved_articles"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    url = Column(String)
    title = Column(String)
    summary = Column(String, nullable=True) # AI summary
    thumbnail_url = Column(String, nullable=True)
    author = Column(String, nullable=True)
    published_at = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="saved_articles")

class UsageLog(Base):
    __tablename__ = "usage_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    date = Column(String) # Format YYYY-MM-DD
    action = Column(String, default="unlock") # unlock, summarize, tts
    count = Column(Integer, default=0)
    
    user = relationship("User", back_populates="usage_logs")

class ContentCache(Base):
    __tablename__ = "content_cache"
    __table_args__ = (
        Index("ix_content_cache_url_source", "url", "source", unique=True),
    )

    id = Column(Integer, primary_key=True, index=True)
    url = Column(String, nullable=False)
    source = Column(String, nullable=False)
    license = Column(String, nullable=True)
    content_html = Column(String, nullable=True)
    content_text = Column(String, nullable=True)
    summary = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# Database Setup
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./nook.db")
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    Base.metadata.create_all(bind=engine)