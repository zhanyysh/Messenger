import enum
from datetime import datetime, timezone

from app.db.base_class import Base
from app.core.encryption import decrypt_content, encrypt_content
from sqlalchemy import Boolean, Column, DateTime, TypeDecorator
from sqlalchemy import Enum as SQLEnum
from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship


class EncryptedString(TypeDecorator):
    """
    Transparently encrypt and decrypt strings for database storage.
    """

    impl = Text
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        return encrypt_content(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        return decrypt_content(value)


class MessageType(str, enum.Enum):
    TEXT = "text"
    IMAGE = "image"
    FILE = "file"
    VOICE = "voice"


class Message(Base):
    id = Column(Integer, primary_key=True, index=True)
    chat_id = Column(
        Integer, ForeignKey("chat.id", ondelete="CASCADE"), nullable=False, index=True
    )
    sender_id = Column(
        Integer, ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True
    )
    content = Column(
        EncryptedString, nullable=True
    )  # Automatically encrypted/decrypted
    type = Column(SQLEnum(MessageType), default=MessageType.TEXT, nullable=False)
    is_edited = Column(Boolean(), default=False)
    timestamp = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        index=True,
    )

    chat = relationship("Chat", back_populates="messages")
    sender = relationship("User")
