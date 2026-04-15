from sqlalchemy import Column, Integer, String, Text, DateTime
from core.database import Base
import datetime


class NewsPost(Base):
    __tablename__ = "news_posts"

    protocol = Column(String(50), default="ActivityPub")
    id = Column(Integer, primary_key=True, index=True)
    category = Column(String(50))
    language = Column(String(10))
    title = Column(String(255))
    author = Column(String(255))
    content = Column(Text)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
