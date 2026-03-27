import json
from typing import Dict, List

from app.api import deps
from app.crud import crud_message
from app.models.message import MessageType
from app.schemas.message import MessageCreate
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


class ConnectionManager:
    def __init__(self):
        # Maps chat_id to active websocket connections
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, chat_id: int):
        await websocket.accept()
        if chat_id not in self.active_connections:
            self.active_connections[chat_id] = []
        self.active_connections[chat_id].append(websocket)

    def disconnect(self, websocket: WebSocket, chat_id: int):
        if chat_id in self.active_connections:
            self.active_connections[chat_id].remove(websocket)
            if not self.active_connections[chat_id]:
                del self.active_connections[chat_id]

    async def broadcast(self, message: str, chat_id: int):
        if chat_id in self.active_connections:
            for connection in self.active_connections[chat_id]:
                await connection.send_text(message)


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

    await manager.connect(websocket, chat_id)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                # Try to parse as JSON for rich media messages
                msg_data = json.loads(data)
                content = msg_data.get("content")
                msg_type = msg_data.get("type", MessageType.TEXT)
            except json.JSONDecodeError:
                # Fallback to plain text if not JSON
                content = data
                msg_type = MessageType.TEXT

            # Save message to DB
            msg_in = MessageCreate(content=content, type=msg_type)
            saved_msg = await crud_message.create_message(
                db=db, obj_in=msg_in, chat_id=chat_id, sender_id=user.id
            )

            # Broadcast to all users in room
            payload = {
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
        manager.disconnect(websocket, chat_id)
