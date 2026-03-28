from datetime import datetime
from typing import Optional

from app.models.message import MessageType
from app.schemas.user import User
from pydantic import BaseModel, ConfigDict


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

    model_config = ConfigDict(from_attributes=True)
