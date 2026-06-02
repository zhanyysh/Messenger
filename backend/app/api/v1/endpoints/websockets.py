import json
from datetime import datetime, timezone
from typing import Dict, List, Optional, Set, Tuple

from app.api import deps
from app.crud import crud_chat
from app.crud import crud_message
from app.crud import crud_user
from app.models.message import MessageType
from app.schemas.message import MessageCreate
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


class ConnectionManager:
    def __init__(self):
        # Maps chat_id to active websocket connections
        self.active_connections: Dict[int, List[WebSocket]] = {}
        self.websocket_users: Dict[WebSocket, int] = {}
        self.user_connection_counts: Dict[int, int] = {}

    async def connect(self, websocket: WebSocket, chat_id: int, user_id: int) -> bool:
        await websocket.accept()
        if chat_id not in self.active_connections:
            self.active_connections[chat_id] = []
        self.active_connections[chat_id].append(websocket)
        self.websocket_users[websocket] = user_id

        previous_count = self.user_connection_counts.get(user_id, 0)
        self.user_connection_counts[user_id] = previous_count + 1
        return previous_count == 0

    def disconnect(
        self, websocket: WebSocket, chat_id: int
    ) -> Tuple[Optional[int], bool]:
        user_id = self.websocket_users.pop(websocket, None)

        if chat_id in self.active_connections:
            if websocket in self.active_connections[chat_id]:
                self.active_connections[chat_id].remove(websocket)
            if not self.active_connections[chat_id]:
                del self.active_connections[chat_id]

        if user_id is None:
            return None, False

        remaining = self.user_connection_counts.get(user_id, 0) - 1
        if remaining > 0:
            self.user_connection_counts[user_id] = remaining
            return user_id, False

        self.user_connection_counts.pop(user_id, None)
        return user_id, True

    async def broadcast(self, message: str, chat_id: int):
        if chat_id in self.active_connections:
            for connection in self.active_connections[chat_id]:
                await connection.send_text(message)

    async def broadcast_presence(self, message: str):
        connections: Set[WebSocket] = set()
        for chat_connections in self.active_connections.values():
            connections.update(chat_connections)

        for connection in connections:
            await connection.send_text(message)

    def get_online_user_ids(self, user_ids: List[int]) -> List[int]:
        return [
            user_id
            for user_id in user_ids
            if self.user_connection_counts.get(user_id, 0) > 0
        ]

    def is_user_online(self, user_id: int) -> bool:
        return self.user_connection_counts.get(user_id, 0) > 0


manager = ConnectionManager()


@router.websocket("/{chat_id}")
async def websocket_endpoint(
    websocket: WebSocket, chat_id: int, db: AsyncSession = Depends(deps.get_db)
):
    # Authenticate via query parameter
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=1008)
        return

    try:
        user = await deps.get_current_user(token=token, db=db)
    except Exception as e:
        await websocket.accept()  # Accept before sending
        await websocket.send_text(
            json.dumps(
                {"sender_name": "System", "content": f"Auth failed! Details: {repr(e)}"}
            )
        )
        await websocket.close(code=1008)
        return

    chat = await crud_chat.get_chat(db, chat_id=chat_id)
    if not chat or not any(
        participant.user_id == user.id for participant in chat.participants
    ):
        await websocket.close(code=1008)
        return

    is_first_connection_for_user = await manager.connect(websocket, chat_id, user.id)

    participant_user_ids = [
        participant.user_id
        for participant in chat.participants
        if participant.user_id != user.id
    ]
    presence_snapshot = {
        "event": "presence_snapshot",
        "chat_id": chat_id,
        "online_user_ids": manager.get_online_user_ids(participant_user_ids),
    }
    await websocket.send_text(json.dumps(presence_snapshot))

    if is_first_connection_for_user:
        await manager.broadcast_presence(
            json.dumps(
                {
                    "event": "presence_update",
                    "user_id": user.id,
                    "is_online": True,
                }
            )
        )

    try:
        while True:
            data = await websocket.receive_text()
            event_type = "message"
            try:
                # Try to parse as JSON for rich media messages
                msg_data = json.loads(data)
                event_type = msg_data.get("event", "message")

                if event_type == "typing":
                    typing_payload = {
                        "event": "typing",
                        "chat_id": chat_id,
                        "sender_id": user.id,
                        "sender_name": user.full_name or user.email,
                        "is_typing": bool(msg_data.get("is_typing", True)),
                    }
                    await manager.broadcast(json.dumps(typing_payload), chat_id)
                    continue

                if event_type == "edit_message":
                    message_id = msg_data.get("message_id")
                    new_content = msg_data.get("content")
                    if not message_id or not new_content:
                        continue

                    db_msg = await crud_message.get_message(db, message_id)
                    if not db_msg or db_msg.sender_id != user.id:
                        continue

                    await crud_message.update_message(db, db_msg, new_content)

                    edit_payload = {
                        "event": "edit_message",
                        "id": message_id,
                        "chat_id": chat_id,
                        "content": new_content,
                        "sender_id": user.id,
                    }
                    await manager.broadcast(json.dumps(edit_payload), chat_id)
                    continue

                if event_type == "delete_message":
                    message_id = msg_data.get("message_id")
                    if not message_id:
                        continue

                    db_msg = await crud_message.get_message(db, message_id)
                    if not db_msg or db_msg.sender_id != user.id:
                        continue

                    await crud_message.delete_message(db, db_msg)

                    delete_payload = {
                        "event": "delete_message",
                        "id": message_id,
                        "chat_id": chat_id,
                    }
                    await manager.broadcast(json.dumps(delete_payload), chat_id)
                    continue

                content = msg_data.get("content")
                msg_type = msg_data.get("type", MessageType.TEXT)
            except json.JSONDecodeError:
                # Fallback to plain text if not JSON
                content = data
                msg_type = MessageType.TEXT

            if not content:
                continue

            # Save message to DB
            msg_in = MessageCreate(content=content, type=msg_type)
            saved_msg = await crud_message.create_message(
                db=db, obj_in=msg_in, chat_id=chat_id, sender_id=user.id
            )

            # Broadcast to all users in room
            payload = {
                "event": "message",
                "id": saved_msg.id,
                "chat_id": chat_id,
                "content": saved_msg.content,
                "type": saved_msg.type,
                "sender_id": user.id,
                "sender_name": user.full_name or user.email,
                "timestamp": saved_msg.timestamp.isoformat(),
            }
            await manager.broadcast(json.dumps(payload), chat_id)

    except WebSocketDisconnect:
        pass
    finally:
        disconnected_user_id, is_last_connection = manager.disconnect(
            websocket, chat_id
        )
        if disconnected_user_id is not None and is_last_connection:
            await crud_user.touch_last_seen(db, user)
            await manager.broadcast_presence(
                json.dumps(
                    {
                        "event": "presence_update",
                        "user_id": disconnected_user_id,
                        "is_online": False,
                        "last_seen": (
                            user.last_seen.isoformat()
                            if user.last_seen
                            else datetime.now(timezone.utc)
                            .replace(tzinfo=None)
                            .isoformat()
                        ),
                    }
                )
            )
