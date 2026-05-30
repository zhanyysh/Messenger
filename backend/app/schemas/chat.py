from datetime import datetime
from typing import List, Optional

from app.models.chat import ChatType, ParticipantRole
from app.schemas.user import User
from pydantic import BaseModel, ConfigDict


class ChatParticipantBase(BaseModel):
    user_id: int
    role: ParticipantRole = ParticipantRole.MEMBER


class ChatParticipantCreate(ChatParticipantBase):
    pass


class ChatParticipantUpdate(BaseModel):
    role: ParticipantRole


class ChatParticipantResponse(ChatParticipantBase):
    joined_at: datetime
    user: User

    model_config = ConfigDict(from_attributes=True)


class ChatBase(BaseModel):
    type: ChatType
    name: Optional[str] = None
    image_url: Optional[str] = None


class ChatCreate(ChatBase):
    participant_emails: List[str]  # Emails of users to add to the chat


class ChatUpdate(BaseModel):
    name: Optional[str] = None
    image_url: Optional[str] = None


class ChatResponse(ChatBase):
    id: int
    created_at: datetime
    unread_count: int = 0
    last_message_content: Optional[str] = None
    last_message_type: Optional[str] = None
    last_message_sender_id: Optional[int] = None
    last_message_sender_name: Optional[str] = None
    last_message_timestamp: Optional[datetime] = None
    participants: List[ChatParticipantResponse] = []

    model_config = ConfigDict(from_attributes=True)
