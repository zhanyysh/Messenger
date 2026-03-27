import enum
from datetime import datetime, timezone

from app.db.base_class import Base
from sqlalchemy import Column, DateTime
from sqlalchemy import Enum as SQLEnum
from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import relationship


class ChatType(str, enum.Enum):
    PRIVATE = "private"
    GROUP = "group"


class ParticipantRole(str, enum.Enum):
    ADMIN = "admin"
    MEMBER = "member"


class Chat(Base):
    id = Column(Integer, primary_key=True, index=True)
    type = Column(SQLEnum(ChatType), nullable=False)
    name = Column(String, nullable=True)  # Populated if it's a group chat
    created_at = Column(
        DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )

    participants = relationship(
        "ChatParticipant", back_populates="chat", cascade="all, delete-orphan"
    )
    messages = relationship(
        "Message", back_populates="chat", cascade="all, delete-orphan"
    )


class ChatParticipant(Base):
    __tablename__ = "chat_participant"
    chat_id = Column(
        Integer, ForeignKey("chat.id", ondelete="CASCADE"), primary_key=True
    )
    user_id = Column(
        Integer, ForeignKey("user.id", ondelete="CASCADE"), primary_key=True
    )
    role = Column(
        SQLEnum(ParticipantRole), default=ParticipantRole.MEMBER, nullable=False
    )
    joined_at = Column(
        DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )

    chat = relationship("Chat", back_populates="participants")
    user = relationship("User")
