from typing import Any

from app.api import deps
from app.crud import crud_chat, crud_message
from app.models.user import User
from app.schemas.ai import AIReplySuggestionRequest, AIReplySuggestionResponse
from app.services.gemini import GeminiAssistantError, generate_reply_suggestions
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


def _resolve_sender_name(message_sender) -> str:
    if not message_sender:
        return "Unknown"
    return message_sender.full_name or message_sender.email or "Unknown"


@router.post("/reply-suggestion", response_model=AIReplySuggestionResponse)
async def create_reply_suggestion(
    *,
    db: AsyncSession = Depends(deps.get_db),
    suggestion_in: AIReplySuggestionRequest,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    chat = await crud_chat.get_chat(db, chat_id=suggestion_in.chat_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    if not any(participant.user_id == current_user.id for participant in chat.participants):
        raise HTTPException(status_code=403, detail="Not a participant of this chat")

    selected_message = await crud_message.get_message(db, suggestion_in.message_id)
    if not selected_message or selected_message.chat_id != chat.id:
        raise HTTPException(status_code=404, detail="Message not found")

    context_messages = await crud_message.get_messages_around_id(
        db=db, chat_id=chat.id, message_id=selected_message.id, limit=8
    )

    context_payload = []
    for message in context_messages:
        sender = message.sender
        context_payload.append(
            {
                "id": message.id,
                "sender_id": message.sender_id,
                "sender_name": _resolve_sender_name(sender),
                "content": message.content or "",
                "timestamp": message.timestamp,
                "is_current_message": message.id == selected_message.id,
            }
        )

    try:
        result = await generate_reply_suggestions(
            chat_name=chat.name or "Direct chat",
            selected_message_sender_name=_resolve_sender_name(selected_message.sender),
            selected_message_content=selected_message.content or "",
            context_messages=context_payload,
            suggestion_count=suggestion_in.suggestion_count,
            user_prompt=suggestion_in.user_prompt,
        )
    except GeminiAssistantError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    return AIReplySuggestionResponse(
        chat_id=chat.id,
        message_id=selected_message.id,
        reply=result["reply"],
        suggestions=result["suggestions"],
        rationale=result.get("rationale"),
        context_messages=[
            {
                "id": item["id"],
                "sender_id": item["sender_id"],
                "sender_name": item["sender_name"],
                "content": item["content"],
                "timestamp": item["timestamp"],
                "is_current_message": item["is_current_message"],
            }
            for item in context_payload
        ],
    )