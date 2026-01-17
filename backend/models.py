from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker
from datetime import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    tier = Column(String, default="seeker") # seeker (free), insider, patron
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
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="saved_articles")

class UsageLog(Base):
    __tablename__ = "usage_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    date = Column(String) # Format YYYY-MM-DD
    count = Column(Integer, default=0)
    
    user = relationship("User", back_populates="usage_logs")

# Database Setup
DATABASE_URL = "sqlite:///./nook.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    Base.metadata.create_all(bind=engine)
