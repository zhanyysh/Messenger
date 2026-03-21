from typing import Optional
from datetime import datetime
from pydantic import BaseModel
from app.models.message import MessageType
from app.schemas.user import User

class MessageBase(BaseModel):
    content: Optional[str] = None
    type: MessageType = MessageType.TEXT

class MessageCreate(MessageBase):
    pass

class MessageResponse(MessageBase):
    id: int
    chat_id: int
    sender_id: int
    timestamp: datetime
    sender: User

    class Config:
        from_attributes = True
