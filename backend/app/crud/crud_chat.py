from typing import List, Optional

from app.models.chat import Chat, ChatParticipant, ChatType, ParticipantRole
from app.models.user import User
from app.schemas.chat import ChatCreate
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload


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


async def get_chat(db: AsyncSession, chat_id: int) -> Optional[Chat]:
    stmt = (
        select(Chat)
        .options(selectinload(Chat.participants).selectinload(ChatParticipant.user))
        .filter(Chat.id == chat_id)
    )
    result = await db.execute(stmt)
    return result.scalars().first()


async def add_chat_member(
    db: AsyncSession,
    chat_id: int,
    user_id: int,
    role: ParticipantRole = ParticipantRole.MEMBER,
) -> ChatParticipant:
    db_obj = ChatParticipant(chat_id=chat_id, user_id=user_id, role=role)
    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    return db_obj


async def get_participant(
    db: AsyncSession, chat_id: int, user_id: int
) -> Optional[ChatParticipant]:
    stmt = select(ChatParticipant).filter(
        ChatParticipant.chat_id == chat_id, ChatParticipant.user_id == user_id
    )
    result = await db.execute(stmt)
    return result.scalars().first()


async def remove_participant(db: AsyncSession, chat_id: int, user_id: int) -> bool:
    stmt = select(ChatParticipant).filter(
        ChatParticipant.chat_id == chat_id, ChatParticipant.user_id == user_id
    )
    result = await db.execute(stmt)
    participant = result.scalars().first()

    if participant:
        await db.delete(participant)
        await db.commit()
        return True
    return False


async def update_participant_role(
    db: AsyncSession, chat_id: int, user_id: int, new_role: ParticipantRole
) -> Optional[ChatParticipant]:
    stmt = select(ChatParticipant).filter(
        ChatParticipant.chat_id == chat_id, ChatParticipant.user_id == user_id
    )
    result = await db.execute(stmt)
    participant = result.scalars().first()

    if participant:
        participant.role = new_role
        await db.commit()
        await db.refresh(participant)
        return participant
    return None
