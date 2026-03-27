from datetime import datetime, timedelta, timezone

import pytest
from app.crud import crud_chat, crud_message
from app.models.chat import Chat, ChatParticipant, ChatType, ParticipantRole
from app.models.user import User
from app.schemas.message import MessageCreate


@pytest.mark.asyncio
async def test_unread_count_excludes_own_messages(db_session):
    user_a = User(
        email="user_a@test.local",
        hashed_password="hash",
        full_name="User A",
    )
    user_b = User(
        email="user_b@test.local",
        hashed_password="hash",
        full_name="User B",
    )
    db_session.add_all([user_a, user_b])
    await db_session.flush()

    chat = Chat(type=ChatType.GROUP, name="Ops")
    db_session.add(chat)
    await db_session.flush()

    baseline = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=10)
    db_session.add_all(
        [
            ChatParticipant(
                chat_id=chat.id,
                user_id=user_a.id,
                role=ParticipantRole.ADMIN,
                last_read_at=baseline,
            ),
            ChatParticipant(
                chat_id=chat.id,
                user_id=user_b.id,
                role=ParticipantRole.MEMBER,
                last_read_at=baseline,
            ),
        ]
    )
    await db_session.commit()

    await crud_message.create_message(
        db=db_session,
        obj_in=MessageCreate(content="hello from b"),
        chat_id=chat.id,
        sender_id=user_b.id,
    )

    unread_for_a = await crud_chat.get_unread_count(
        db=db_session, chat_id=chat.id, user_id=user_a.id
    )
    unread_for_b = await crud_chat.get_unread_count(
        db=db_session, chat_id=chat.id, user_id=user_b.id
    )

    assert unread_for_a == 1
    assert unread_for_b == 0


@pytest.mark.asyncio
async def test_mark_chat_as_read_clears_unread_count(db_session):
    user_a = User(
        email="reader@test.local",
        hashed_password="hash",
        full_name="Reader",
    )
    user_b = User(
        email="writer@test.local",
        hashed_password="hash",
        full_name="Writer",
    )
    db_session.add_all([user_a, user_b])
    await db_session.flush()

    chat = Chat(type=ChatType.GROUP, name="Signals")
    db_session.add(chat)
    await db_session.flush()

    baseline = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=10)
    db_session.add_all(
        [
            ChatParticipant(
                chat_id=chat.id,
                user_id=user_a.id,
                role=ParticipantRole.ADMIN,
                last_read_at=baseline,
            ),
            ChatParticipant(
                chat_id=chat.id,
                user_id=user_b.id,
                role=ParticipantRole.MEMBER,
                last_read_at=baseline,
            ),
        ]
    )
    await db_session.commit()

    await crud_message.create_message(
        db=db_session,
        obj_in=MessageCreate(content="new intel"),
        chat_id=chat.id,
        sender_id=user_b.id,
    )

    before_read = await crud_chat.get_unread_count(
        db=db_session, chat_id=chat.id, user_id=user_a.id
    )
    assert before_read == 1

    await crud_chat.mark_chat_as_read(db=db_session, chat_id=chat.id, user_id=user_a.id)

    after_read = await crud_chat.get_unread_count(
        db=db_session, chat_id=chat.id, user_id=user_a.id
    )
    assert after_read == 0
