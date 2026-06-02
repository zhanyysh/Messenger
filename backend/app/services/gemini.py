import json
import re
from typing import List, Optional

import httpx
from app.core.config import settings


class GeminiAssistantError(RuntimeError):
    pass


def _extract_json_payload(text: str) -> dict:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise GeminiAssistantError("Gemini response did not contain JSON")

    return json.loads(cleaned[start : end + 1])


def _build_prompt(
    *,
    chat_name: str,
    selected_message_sender_name: str,
    selected_message_content: str,
    context_messages: List[dict],
    suggestion_count: int,
    user_prompt: Optional[str],
) -> str:
    context_lines = []
    for message in context_messages:
        prefix = "[target]" if message.get("is_current_message") else ""
        context_lines.append(f"{prefix}{message['sender_name']}: {message['content']}")

    prompt_context = (
        f"User prompt: {user_prompt}\n"
        if user_prompt
        else "User prompt: Help me draft a reply to this message.\n"
    )

    return (
        "You are a helpful reply assistant inside a chat app. "
        "Generate concise, natural replies the user could send back. "
        "Return JSON only with keys: reply (string), suggestions (array of strings), and rationale (string). "
        f"Provide exactly {suggestion_count} suggestions. "
        "Avoid generic fluff. Match the tone of the conversation. "
        "Do not mention policies or that you are an AI.\n\n"
        f"Chat: {chat_name}\n"
        f"Selected message from {selected_message_sender_name}: {selected_message_content}\n"
        f"{prompt_context}"
        "Context:\n" + "\n".join(context_lines)
    )


async def generate_reply_suggestions(
    *,
    chat_name: str,
    selected_message_sender_name: str,
    selected_message_content: str,
    context_messages: List[dict],
    suggestion_count: int = 3,
    user_prompt: Optional[str] = None,
) -> dict:
    if not settings.GEMINI_API_KEY:
        raise GeminiAssistantError("GEMINI_API_KEY is not configured")

    prompt = _build_prompt(
        chat_name=chat_name,
        selected_message_sender_name=selected_message_sender_name,
        selected_message_content=selected_message_content,
        context_messages=context_messages,
        suggestion_count=suggestion_count,
        user_prompt=user_prompt,
    )

    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{settings.GEMINI_MODEL}:generateContent?key={settings.GEMINI_API_KEY}"
    )

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": prompt}],
            }
        ],
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 512,
            "responseMimeType": "application/json",
        },
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(url, json=payload)

    if response.status_code >= 400:
        detail = None
        try:
            detail = response.json().get("error", {}).get("message")
        except Exception:
            detail = response.text.strip() or None

        if response.status_code == 429:
            raise GeminiAssistantError(
                "Gemini quota exceeded or billing is disabled for this API key"
            )

        if response.status_code == 404:
            raise GeminiAssistantError(
                f"Gemini model {settings.GEMINI_MODEL} is not available for this API key"
            )

        raise GeminiAssistantError(
            "Gemini request failed with status "
            f"{response.status_code}{f': {detail}' if detail else ''}"
        )

    body = response.json()
    candidates = body.get("candidates") or []
    if not candidates:
        raise GeminiAssistantError("Gemini returned no candidates")

    parts = candidates[0].get("content", {}).get("parts", [])
    text = "".join(part.get("text", "") for part in parts).strip()
    parsed = _extract_json_payload(text)

    suggestions = parsed.get("suggestions") or []
    rationale = parsed.get("rationale")
    reply = parsed.get("reply") or ""

    if not isinstance(suggestions, list):
        raise GeminiAssistantError("Gemini suggestions payload is invalid")

    normalized_suggestions = [
        str(item).strip() for item in suggestions if str(item).strip()
    ]
    if not normalized_suggestions:
        raise GeminiAssistantError("Gemini returned no suggestions")

    normalized_reply = str(reply).strip() or normalized_suggestions[0]

    return {
        "reply": normalized_reply,
        "suggestions": normalized_suggestions[:suggestion_count],
        "rationale": str(rationale).strip() if rationale else None,
    }
