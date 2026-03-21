from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.models.chat import Chat, ChatParticipant, ChatType, ParticipantRole
from app.models.user import User
from app.schemas.chat import ChatCreate

async def create_chat(db: AsyncSession, obj_in: ChatCreate, current_user: User) -> Chat:
    db_chat = Chat(type=obj_in.type, name=obj_in.name)
    db.add(db_chat)
    await db.flush()  # To get db_chat.id

    # Add the creator as Admin
    admin_participant = ChatParticipant(
        chat_id=db_chat.id, user_id=current_user.id, role=ParticipantRole.ADMIN
    )
    db.add(admin_participant)

    # Resolve emails to user IDs
    for email in obj_in.participant_emails:
        result = await db.execute(select(User).filter(User.email == email))
        user = result.scalars().first()
        if user and user.id != current_user.id:
            member = ChatParticipant(
                chat_id=db_chat.id, user_id=user.id, role=ParticipantRole.MEMBER
            )
            db.add(member)

    await db.commit()
    # Refetch with relationships to return complete response
    stmt = (
        select(Chat)
        .options(selectinload(Chat.participants).selectinload(ChatParticipant.user))
        .filter(Chat.id == db_chat.id)
    )
    result = await db.execute(stmt)
    return result.scalars().first()

async def get_user_chats(db: AsyncSession, user_id: int) -> List[Chat]:
    stmt = (
        select(Chat)
        .join(ChatParticipant)
        .options(selectinload(Chat.participants).selectinload(ChatParticipant.user))
        .filter(ChatParticipant.user_id == user_id)
        .order_by(Chat.created_at.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()
