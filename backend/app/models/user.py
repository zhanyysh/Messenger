from datetime import datetime, timezone

from app.db.base_class import Base
from sqlalchemy import Boolean, Column, DateTime, Integer, String


class User(Base):
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=True)
    full_name = Column(String, index=True)
    bio = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    last_seen = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        nullable=True,
    )
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean(), default=True)
    is_superuser = Column(Boolean(), default=False)
