from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel
from app.models.chat import ChatType, ParticipantRole
from app.schemas.user import User

class ChatParticipantBase(BaseModel):
    user_id: int
    role: ParticipantRole = ParticipantRole.MEMBER

class ChatParticipantCreate(ChatParticipantBase):
    pass

class ChatParticipantResponse(ChatParticipantBase):
    joined_at: datetime
    user: User

    class Config:
        from_attributes = True

class ChatBase(BaseModel):
    type: ChatType
    name: Optional[str] = None

class ChatCreate(ChatBase):
    participant_emails: List[str]  # Emails of users to add to the chat

class ChatResponse(ChatBase):
    id: int
    created_at: datetime
    participants: List[ChatParticipantResponse] = []

    class Config:
        from_attributes = True
