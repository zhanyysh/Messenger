import json
import os
from datetime import datetime, timezone

import pytest

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test_runtime.db")
os.environ.setdefault("SECRET_KEY", "test-secret-key")

from app.api import deps
from app.api.v1.endpoints.websockets import manager, websocket_endpoint
from app.models.chat import Chat, ChatParticipant, ChatType, ParticipantRole
from app.models.message import Message
from app.models.user import User
from fastapi import WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


class FakeWebSocket:
    def __init__(self, token: str, incoming_messages: list[str]):
        self.query_params = {"token": token}
        self._incoming_messages = incoming_messages
        self._accepted = False
        self.sent_texts: list[str] = []

    async def accept(self):
        self._accepted = True

    async def receive_text(self) -> str:
        if self._incoming_messages:
            return self._incoming_messages.pop(0)
        raise WebSocketDisconnect()

    async def send_text(self, message: str):
        self.sent_texts.append(message)

    async def close(self, code: int = 1000):
        return None


async def _seed_user_and_chat(db_session: AsyncSession):
    user = User(
        email="ws_user@example.com",
        hashed_password="hash",
        full_name="WebSocket User",
    )
    db_session.add(user)
    await db_session.flush()

    chat = Chat(type=ChatType.GROUP, name="Socket Ops")
    db_session.add(chat)
    await db_session.flush()

    db_session.add(
        ChatParticipant(
            chat_id=chat.id,
            user_id=user.id,
            role=ParticipantRole.ADMIN,
            joined_at=datetime.now(timezone.utc).replace(tzinfo=None),
        )
    )
    await db_session.commit()

    return user, chat


@pytest.mark.asyncio
async def test_typing_event_broadcasts_and_does_not_persist_message(
    db_session: AsyncSession, monkeypatch
):
    user, chat = await _seed_user_and_chat(db_session)

    async def fake_get_current_user(token: str, db: AsyncSession):
        return user

    monkeypatch.setattr(deps, "get_current_user", fake_get_current_user)
    manager.active_connections.clear()

    ws = FakeWebSocket(
        token="fake-token",
        incoming_messages=[json.dumps({"event": "typing", "is_typing": True})],
    )

    await websocket_endpoint(ws, chat.id, db_session)

    assert ws._accepted is True
    assert len(ws.sent_texts) == 1

    payload = json.loads(ws.sent_texts[0])
    assert payload["event"] == "typing"
    assert payload["chat_id"] == chat.id
    assert payload["sender_id"] == user.id
    assert payload["is_typing"] is True

    result = await db_session.execute(
        select(Message).filter(Message.chat_id == chat.id)
    )
    assert result.scalars().all() == []


@pytest.mark.asyncio
async def test_message_event_persists_and_broadcasts_message_payload(
    db_session: AsyncSession, monkeypatch
):
    user, chat = await _seed_user_and_chat(db_session)

    async def fake_get_current_user(token: str, db: AsyncSession):
        return user

    monkeypatch.setattr(deps, "get_current_user", fake_get_current_user)
    manager.active_connections.clear()

    ws = FakeWebSocket(
        token="fake-token",
        incoming_messages=[
            json.dumps({"event": "message", "content": "hello over ws", "type": "text"})
        ],
    )

    await websocket_endpoint(ws, chat.id, db_session)

    assert ws._accepted is True
    assert len(ws.sent_texts) == 1

    payload = json.loads(ws.sent_texts[0])
    assert payload["event"] == "message"
    assert payload["chat_id"] == chat.id
    assert payload["sender_id"] == user.id
    assert payload["content"] == "hello over ws"

    result = await db_session.execute(
        select(Message).filter(Message.chat_id == chat.id)
    )
    messages = result.scalars().all()
    assert len(messages) == 1
    assert messages[0].content == "hello over ws"
