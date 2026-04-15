from sqlalchemy import Boolean, Column, DateTime, Integer, String
from core.database import Base
import datetime


class WalletSubscription(Base):
    __tablename__ = "wallet_subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    wallet_address = Column(String(255), unique=True, index=True, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    tx_hash = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.datetime.utcnow,
        onupdate=datetime.datetime.utcnow,
        nullable=False,
    )
