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


@pytest.fixture(autouse=True)
def reset_manager_state():
    manager.active_connections.clear()
    manager.websocket_users.clear()
    manager.user_connection_counts.clear()
    yield
    manager.active_connections.clear()
    manager.websocket_users.clear()
    manager.user_connection_counts.clear()


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


async def _seed_chat_with_two_users(db_session: AsyncSession):
    member = User(
        email="ws_member@example.com",
        hashed_password="hash",
        full_name="Chat Member",
    )
    intruder = User(
        email="ws_intruder@example.com",
        hashed_password="hash",
        full_name="Intruder",
    )
    db_session.add_all([member, intruder])
    await db_session.flush()

    chat = Chat(type=ChatType.GROUP, name="Secure Room")
    db_session.add(chat)
    await db_session.flush()

    db_session.add(
        ChatParticipant(
            chat_id=chat.id,
            user_id=member.id,
            role=ParticipantRole.ADMIN,
            joined_at=datetime.now(timezone.utc).replace(tzinfo=None),
        )
    )
    await db_session.commit()

    return member, intruder, chat


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
    assert len(ws.sent_texts) == 3

    snapshot = json.loads(ws.sent_texts[0])
    assert snapshot["event"] == "presence_snapshot"
    assert snapshot["chat_id"] == chat.id
    assert snapshot["online_user_ids"] == []

    online_update = json.loads(ws.sent_texts[1])
    assert online_update["event"] == "presence_update"
    assert online_update["user_id"] == user.id
    assert online_update["is_online"] is True

    payload = json.loads(ws.sent_texts[2])
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
    assert len(ws.sent_texts) == 3

    snapshot = json.loads(ws.sent_texts[0])
    assert snapshot["event"] == "presence_snapshot"
    assert snapshot["chat_id"] == chat.id

    online_update = json.loads(ws.sent_texts[1])
    assert online_update["event"] == "presence_update"
    assert online_update["user_id"] == user.id
    assert online_update["is_online"] is True

    payload = json.loads(ws.sent_texts[2])
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


@pytest.mark.asyncio
async def test_websocket_presence_snapshot_and_offline_event(
    db_session: AsyncSession, monkeypatch
):
    online_user = User(
        email="online_user@example.com",
        hashed_password="hash",
        full_name="Online User",
    )
    joining_user = User(
        email="joining_user@example.com",
        hashed_password="hash",
        full_name="Joining User",
    )
    db_session.add_all([online_user, joining_user])
    await db_session.flush()

    chat = Chat(type=ChatType.GROUP, name="Presence Room")
    db_session.add(chat)
    await db_session.flush()

    db_session.add_all(
        [
            ChatParticipant(
                chat_id=chat.id,
                user_id=online_user.id,
                role=ParticipantRole.ADMIN,
                joined_at=datetime.now(timezone.utc).replace(tzinfo=None),
            ),
            ChatParticipant(
                chat_id=chat.id,
                user_id=joining_user.id,
                role=ParticipantRole.MEMBER,
                joined_at=datetime.now(timezone.utc).replace(tzinfo=None),
            ),
        ]
    )
    await db_session.commit()

    async def fake_get_current_user(token: str, db: AsyncSession):
        return joining_user

    monkeypatch.setattr(deps, "get_current_user", fake_get_current_user)

    existing_ws = FakeWebSocket(token="existing-token", incoming_messages=[])
    await manager.connect(existing_ws, chat.id, online_user.id)

    ws = FakeWebSocket(token="fake-token", incoming_messages=[])

    await websocket_endpoint(ws, chat.id, db_session)

    snapshot = json.loads(ws.sent_texts[0])
    assert snapshot["event"] == "presence_snapshot"
    assert snapshot["online_user_ids"] == [online_user.id]

    assert any(
        json.loads(message)["event"] == "presence_update"
        and json.loads(message)["user_id"] == joining_user.id
        and json.loads(message)["is_online"] is True
        for message in existing_ws.sent_texts
    )

    offline_update = [
        json.loads(message)
        for message in existing_ws.sent_texts
        if json.loads(message)["event"] == "presence_update"
        and json.loads(message)["user_id"] == joining_user.id
        and json.loads(message)["is_online"] is False
    ]
    assert offline_update
    assert offline_update[-1]["last_seen"]

    result = await db_session.execute(select(User).filter(User.id == joining_user.id))
    refreshed_user = result.scalars().first()
    assert refreshed_user is not None
    assert refreshed_user.last_seen is not None


@pytest.mark.asyncio
async def test_websocket_rejects_non_participant_user(
    db_session: AsyncSession, monkeypatch
):
    member, intruder, chat = await _seed_chat_with_two_users(db_session)

    async def fake_get_current_user(token: str, db: AsyncSession):
        return intruder

    monkeypatch.setattr(deps, "get_current_user", fake_get_current_user)
    manager.active_connections.clear()

    ws = FakeWebSocket(
        token="fake-token",
        incoming_messages=[
            json.dumps({"event": "message", "content": "should not persist"})
        ],
    )

    await websocket_endpoint(ws, chat.id, db_session)

    assert ws._accepted is False
    assert ws.sent_texts == []
    assert chat.id not in manager.active_connections

    result = await db_session.execute(
        select(Message).filter(Message.chat_id == chat.id)
    )
    assert result.scalars().all() == []
