from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.crud import crud_chat, crud_message
from app.models.user import User
from app.schemas.chat import ChatCreate, ChatResponse
from app.schemas.message import MessageResponse

router = APIRouter()

@router.post("/", response_model=ChatResponse)
async def create_chat(
    *,
    db: AsyncSession = Depends(deps.get_db),
    chat_in: ChatCreate,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Create a new Chat (Private or Group)
    """
    chat = await crud_chat.create_chat(db=db, obj_in=chat_in, current_user=current_user)
    return chat

@router.get("/", response_model=List[ChatResponse])
async def read_chats(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Retrieve all chats the current user is a part of.
    """
    chats = await crud_chat.get_user_chats(db=db, user_id=current_user.id)
    return chats

@router.get("/{chat_id}/messages", response_model=List[MessageResponse])
async def read_chat_messages(
    chat_id: int,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Retrieve conversation history for a specific chat.
    # TODO: Add security check to ensure current_user is in the chat
    """
    messages = await crud_message.get_chat_messages(db=db, chat_id=chat_id, skip=skip, limit=limit)
    return messages
