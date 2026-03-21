from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.models.message import Message
from app.schemas.message import MessageCreate

async def create_message(db: AsyncSession, obj_in: MessageCreate, chat_id: int, sender_id: int) -> Message:
    db_msg = Message(
        chat_id=chat_id,
        sender_id=sender_id,
        content=obj_in.content,
        type=obj_in.type
    )
    db.add(db_msg)
    await db.commit()
    
    # Reload with sender relation to fully populate the schema
    stmt = select(Message).options(selectinload(Message.sender)).filter(Message.id == db_msg.id)
    result = await db.execute(stmt)
    return result.scalars().first()

async def get_chat_messages(db: AsyncSession, chat_id: int, skip: int = 0, limit: int = 50) -> List[Message]:
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
