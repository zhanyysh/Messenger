import os
from datetime import datetime, timedelta, timezone

import pytest

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test_runtime.db")
os.environ.setdefault("SECRET_KEY", "test-secret-key")

from app.api import deps
from app.main import app
from app.models.chat import Chat, ChatParticipant, ChatType, ParticipantRole
from app.models.message import Message
from app.models.user import User
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.fixture()
async def api_client(db_session: AsyncSession):
    current_user_holder = {"user": None}

    async def override_get_db():
        yield db_session

    async def override_get_current_user():
        return current_user_holder["user"]

    app.dependency_overrides[deps.get_db] = override_get_db
    app.dependency_overrides[deps.get_current_user] = override_get_current_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client, current_user_holder

    app.dependency_overrides.clear()


async def _seed_chat_with_unread(db_session: AsyncSession):
    user_a = User(
        email="api_reader@example.com", hashed_password="hash", full_name="Reader"
    )
    user_b = User(
        email="api_writer@example.com", hashed_password="hash", full_name="Writer"
    )
    db_session.add_all([user_a, user_b])
    await db_session.flush()

    chat = Chat(type=ChatType.GROUP, name="API Ops")
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
    await db_session.flush()

    db_session.add(
        Message(
            chat_id=chat.id,
            sender_id=user_b.id,
            content="new message",
        )
    )
    await db_session.commit()

    return user_a, chat


@pytest.mark.asyncio
async def test_read_chats_returns_unread_count(api_client, db_session: AsyncSession):
    client, current_user_holder = api_client
    user_a, chat = await _seed_chat_with_unread(db_session)

    current_user_holder["user"] = user_a
    response = await client.get("/api/v1/chats/")

    assert response.status_code == 200
    payload = response.json()

    chat_payload = next((c for c in payload if c["id"] == chat.id), None)
    assert chat_payload is not None
    assert chat_payload["unread_count"] == 1


@pytest.mark.asyncio
async def test_read_chat_messages_marks_chat_as_read(
    api_client, db_session: AsyncSession
):
    client, current_user_holder = api_client
    user_a, chat = await _seed_chat_with_unread(db_session)

    current_user_holder["user"] = user_a

    messages_response = await client.get(f"/api/v1/chats/{chat.id}/messages")
    assert messages_response.status_code == 200

    chats_response = await client.get("/api/v1/chats/")
    assert chats_response.status_code == 200
    payload = chats_response.json()

    chat_payload = next((c for c in payload if c["id"] == chat.id), None)
    assert chat_payload is not None
    assert chat_payload["unread_count"] == 0
