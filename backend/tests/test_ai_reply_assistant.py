import os
from datetime import datetime, timedelta, timezone

import pytest

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test_runtime.db")
os.environ.setdefault("SECRET_KEY", "test-secret-key")

from app.api import deps
from app.api.v1.endpoints import ai
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


async def _seed_chat_with_messages(db_session: AsyncSession):
    user_a = User(
        email="assistant_reader@example.com", hashed_password="hash", full_name="Reader"
    )
    user_b = User(
        email="assistant_writer@example.com", hashed_password="hash", full_name="Writer"
    )
    db_session.add_all([user_a, user_b])
    await db_session.flush()

    chat = Chat(type=ChatType.GROUP, name="AI Operators")
    db_session.add(chat)
    await db_session.flush()

    baseline = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=5)
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

    previous_message = Message(
        chat_id=chat.id, sender_id=user_a.id, content="We should reply fast"
    )
    target_message = Message(
        chat_id=chat.id,
        sender_id=user_b.id,
        content="Can you help me answer this?",
    )
    next_message = Message(
        chat_id=chat.id, sender_id=user_a.id, content="Keep it short and polite"
    )
    db_session.add_all([previous_message, target_message, next_message])
    await db_session.commit()

    return user_a, user_b, chat, target_message


@pytest.mark.asyncio
async def test_create_reply_suggestion_returns_assistant_options(
    api_client, db_session: AsyncSession, monkeypatch
):
    client, current_user_holder = api_client
    user_a, _, chat, target_message = await _seed_chat_with_messages(db_session)

    current_user_holder["user"] = user_a

    captured = {}

    async def fake_generate_reply_suggestions(**kwargs):
        captured.update(kwargs)
        return {
            "reply": "Sure, here is a concise draft.",
            "suggestions": ["Sure, I can help.", "Yes, here is a good reply."],
            "rationale": "Short and supportive works best.",
        }

    monkeypatch.setattr(
        ai, "generate_reply_suggestions", fake_generate_reply_suggestions
    )

    response = await client.post(
        "/api/v1/ai/reply-suggestion",
        json={
            "chat_id": chat.id,
            "message_id": target_message.id,
            "suggestion_count": 2,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["chat_id"] == chat.id
    assert payload["message_id"] == target_message.id
    assert payload["reply"] == "Sure, here is a concise draft."
    assert payload["suggestions"] == ["Sure, I can help.", "Yes, here is a good reply."]
    assert payload["rationale"] == "Short and supportive works best."
    assert captured["selected_message_content"] == "Can you help me answer this?"
    assert captured["suggestion_count"] == 2
    assert captured["user_prompt"] is None
    assert any(item["is_current_message"] for item in captured["context_messages"])


@pytest.mark.asyncio
async def test_create_reply_suggestion_surfaces_provider_errors(
    api_client, db_session: AsyncSession, monkeypatch
):
    client, current_user_holder = api_client
    user_a, _, chat, target_message = await _seed_chat_with_messages(db_session)

    current_user_holder["user"] = user_a

    async def fake_generate_reply_suggestions(**kwargs):
        raise ai.GeminiAssistantError("Gemini is unavailable")

    monkeypatch.setattr(
        ai, "generate_reply_suggestions", fake_generate_reply_suggestions
    )

    response = await client.post(
        "/api/v1/ai/reply-suggestion",
        json={"chat_id": chat.id, "message_id": target_message.id},
    )

    assert response.status_code == 503
    assert response.json()["detail"] == "Gemini is unavailable"
