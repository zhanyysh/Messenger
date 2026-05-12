from typing import List

from app.models.message import Message
from app.schemas.message import MessageCreate
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload


async def create_message(
    db: AsyncSession, obj_in: MessageCreate, chat_id: int, sender_id: int
) -> Message:
    db_msg = Message(
        chat_id=chat_id, sender_id=sender_id, content=obj_in.content, type=obj_in.type
    )
    db.add(db_msg)
    await db.commit()

    # Reload with sender relation to fully populate the schema
    stmt = (
        select(Message)
        .options(selectinload(Message.sender))
        .filter(Message.id == db_msg.id)
    )
    result = await db.execute(stmt)
    return result.scalars().first()


async def get_chat_messages(
    db: AsyncSession, chat_id: int, skip: int = 0, limit: int = 50
) -> List[Message]:
    stmt = (
        select(Message)
        .options(selectinload(Message.sender))
        .filter(Message.chat_id == chat_id)
        .order_by(Message.timestamp.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(stmt)
    # The order_by desc is useful for paginating newest messages first.
    # Re-reverse it so the UI displays them functionally top-to-bottom.
    messages = result.scalars().all()
    return list(reversed(messages))


async def get_message(db: AsyncSession, message_id: int) -> Message:
    stmt = select(Message).filter(Message.id == message_id)
    result = await db.execute(stmt)
    return result.scalars().first()


async def update_message(db: AsyncSession, db_obj: Message, content: str) -> Message:
    db_obj.content = content
    db_obj.is_edited = True
    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    return db_obj


async def delete_message(db: AsyncSession, db_obj: Message) -> None:
    await db.delete(db_obj)
    await db.commit()


async def search_messages(
    db: AsyncSession, chat_id: int, query: str, limit: int = 50
) -> List[Message]:
    stmt = (
        select(Message)
        .options(selectinload(Message.sender))
        .filter(Message.chat_id == chat_id)
        .filter(Message.content.ilike(f"%{query}%"))
        .order_by(Message.timestamp.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


async def get_messages_around_id(
    db: AsyncSession, chat_id: int, message_id: int, limit: int = 50
) -> List[Message]:
    """
    Fetch messages surrounding a specific message ID to provide context when jumping from search.
    """
    half_limit = limit // 2

    # Fetch messages before and including the target
    stmt_before = (
        select(Message)
        .options(selectinload(Message.sender))
        .filter(Message.chat_id == chat_id)
        .filter(Message.id <= message_id)
        .order_by(Message.timestamp.desc())
        .limit(half_limit)
    )

    # Fetch messages after the target
    stmt_after = (
        select(Message)
        .options(selectinload(Message.sender))
        .filter(Message.chat_id == chat_id)
        .filter(Message.id > message_id)
        .order_by(Message.timestamp.asc())
        .limit(half_limit)
    )

    res_before = await db.execute(stmt_before)
    res_after = await db.execute(stmt_after)

    messages_before = list(res_before.scalars().all())
    messages_after = list(res_after.scalars().all())

    # Combine and sort by timestamp
    combined = messages_before + messages_after
    combined.sort(key=lambda x: x.timestamp)
    return combined
