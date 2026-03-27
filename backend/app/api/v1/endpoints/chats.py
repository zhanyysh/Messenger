from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.crud import crud_chat, crud_message
from app.models.user import User
from app.schemas.chat import ChatCreate, ChatResponse, ChatParticipantCreate, ChatParticipantResponse
from app.models.chat import ParticipantRole, ChatParticipant
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
    """
    # Security check: ensure current_user is in the chat
    chat = await crud_chat.get_chat(db, chat_id=chat_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    if not any(p.user_id == current_user.id for p in chat.participants):
        raise HTTPException(status_code=403, detail="Not a participant of this chat")

    messages = await crud_message.get_chat_messages(db=db, chat_id=chat_id, skip=skip, limit=limit)
    return messages


@router.post("/{chat_id}/members", response_model=ChatParticipantResponse)
async def add_chat_member(
    chat_id: int,
    member_in: ChatParticipantCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Add a new member to a chat. Only Admins can add members.
    """
    chat = await crud_chat.get_chat(db, chat_id=chat_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    # Check if current user is an admin of this chat
    is_admin = any(
        p.user_id == current_user.id and p.role == ParticipantRole.ADMIN
        for p in chat.participants
    )
    if not is_admin:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    # Check if user already in chat
    if any(p.user_id == member_in.user_id for p in chat.participants):
        raise HTTPException(status_code=400, detail="User already in chat")

    member = await crud_chat.add_chat_member(
        db, chat_id=chat_id, user_id=member_in.user_id, role=member_in.role
    )
    
    # Reload member with user info for response
    from sqlalchemy.orm import selectinload
    from sqlalchemy.future import select
    stmt = (
        select(ChatParticipant)
        .options(selectinload(ChatParticipant.user))
        .filter(ChatParticipant.id == member.id)
    )
    result = await db.execute(stmt)
    return result.scalars().first()
