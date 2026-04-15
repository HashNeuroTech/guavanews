from sqlalchemy import Boolean, Column, DateTime, Integer, String
from core.database import Base
import datetime


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    is_premium = Column(Boolean, default=False, nullable=False)
    stripe_customer_id = Column(String(255), nullable=True)
