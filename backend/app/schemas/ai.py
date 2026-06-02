from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class AIReplySuggestionRequest(BaseModel):
    chat_id: int
    message_id: int
    suggestion_count: int = Field(default=3, ge=1, le=5)
    user_prompt: Optional[str] = Field(default=None, max_length=1000)


class AIContextMessage(BaseModel):
    id: int
    sender_id: int
    sender_name: str
    content: str
    timestamp: datetime
    is_current_message: bool = False


class AIReplySuggestionResponse(BaseModel):
    chat_id: int
    message_id: int
    reply: str
    suggestions: List[str]
    rationale: Optional[str] = None
    context_messages: List[AIContextMessage] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)
