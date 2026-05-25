import io
import os

import pytest

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test_runtime.db")
os.environ.setdefault("SECRET_KEY", "test-secret-key")

from app.api import deps
from app.api.v1.endpoints import uploads
from app.main import app
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


def _seed_current_user() -> User:
    return User(
        email="uploader@test.local",
        hashed_password="hash",
        full_name="Uploader",
    )


@pytest.mark.asyncio
async def test_upload_file_returns_public_url(api_client, monkeypatch):
    client, current_user_holder = api_client
    current_user_holder["user"] = _seed_current_user()

    monkeypatch.setattr(uploads.settings, "CLOUDINARY_URL", "cloudinary://key:secret@demo")
    monkeypatch.setattr(uploads.settings, "CLOUDINARY_CLOUD_NAME", None)
    monkeypatch.setattr(uploads.settings, "CLOUDINARY_API_KEY", None)
    monkeypatch.setattr(uploads.settings, "CLOUDINARY_API_SECRET", None)
    monkeypatch.setattr(uploads.settings, "CLOUDINARY_UPLOAD_FOLDER", "chat-media")

    config_calls = []
    upload_calls = []

    def fake_config(**kwargs):
        config_calls.append(kwargs)

    def fake_upload(file_obj, **kwargs):
        upload_calls.append((file_obj, kwargs))
        return {"secure_url": "https://res.cloudinary.com/demo/image/upload/v1/file.png"}

    monkeypatch.setattr(uploads.cloudinary, "config", fake_config)
    monkeypatch.setattr(uploads.cloudinary.uploader, "upload", fake_upload)

    response = await client.post(
        "/api/v1/upload/",
        files={"file": ("avatar.png", io.BytesIO(b"binary-data"), "image/png")},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["url"] == "https://res.cloudinary.com/demo/image/upload/v1/file.png"
    assert payload["filename"] == "avatar.png"
    assert payload["content_type"] == "image/png"

    assert config_calls == [{"cloudinary_url": "cloudinary://key:secret@demo"}]
    assert len(upload_calls) == 1
    uploaded_file, upload_kwargs = upload_calls[0]
    assert uploaded_file.read() == b"binary-data"
    assert upload_kwargs["folder"] == "chat-media"
    assert upload_kwargs["resource_type"] == "auto"


@pytest.mark.asyncio
async def test_upload_file_rejects_missing_cloudinary_config(api_client, monkeypatch):
    client, current_user_holder = api_client
    current_user_holder["user"] = _seed_current_user()

    monkeypatch.setattr(uploads.settings, "CLOUDINARY_URL", None)
    monkeypatch.setattr(uploads.settings, "CLOUDINARY_CLOUD_NAME", None)
    monkeypatch.setattr(uploads.settings, "CLOUDINARY_API_KEY", None)
    monkeypatch.setattr(uploads.settings, "CLOUDINARY_API_SECRET", None)
    monkeypatch.setattr(uploads.settings, "CLOUDINARY_UPLOAD_FOLDER", None)

    response = await client.post(
        "/api/v1/upload/",
        files={"file": ("document.pdf", io.BytesIO(b"pdf-bytes"), "application/pdf")},
    )

    assert response.status_code == 500
    assert response.json()["detail"] == "Cloudinary is not configured on the server"


@pytest.mark.asyncio
async def test_upload_file_surfaces_cloudinary_errors(api_client, monkeypatch):
    client, current_user_holder = api_client
    current_user_holder["user"] = _seed_current_user()

    monkeypatch.setattr(uploads.settings, "CLOUDINARY_URL", "cloudinary://key:secret@demo")
    monkeypatch.setattr(uploads.settings, "CLOUDINARY_CLOUD_NAME", None)
    monkeypatch.setattr(uploads.settings, "CLOUDINARY_API_KEY", None)
    monkeypatch.setattr(uploads.settings, "CLOUDINARY_API_SECRET", None)
    monkeypatch.setattr(uploads.settings, "CLOUDINARY_UPLOAD_FOLDER", None)

    monkeypatch.setattr(uploads.cloudinary, "config", lambda **kwargs: None)

    def fake_upload(*args, **kwargs):
        raise RuntimeError("upload boom")

    monkeypatch.setattr(uploads.cloudinary.uploader, "upload", fake_upload)

    response = await client.post(
        "/api/v1/upload/",
        files={"file": ("voice.webm", io.BytesIO(b"voice-bytes"), "audio/webm")},
    )

    assert response.status_code == 500
    assert response.json()["detail"].startswith("Cloudinary upload failed: upload boom")