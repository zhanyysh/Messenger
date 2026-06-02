import os

import pytest

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test_runtime.db")
os.environ.setdefault("SECRET_KEY", "test-secret-key")

from app.api import deps
from app.crud import crud_user
from app.main import app
from app.models.user import User
from app.schemas.user import UserCreate
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


async def _create_user(
    db_session: AsyncSession, *, email: str, username: str, password: str
) -> User:
    return await crud_user.create(
        db_session,
        obj_in=UserCreate(
            email=email,
            username=username,
            password=password,
            full_name="Test User",
        ),
    )


@pytest.mark.asyncio
async def test_register_user_creates_account(api_client, db_session: AsyncSession):
    client, _ = api_client

    response = await client.post(
        "/api/v1/users/",
        json={
            "email": "new-user@example.com",
            "password": "secret123",
            "full_name": "New User",
            "username": "new_user",
            "is_superuser": False,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["email"] == "new-user@example.com"
    assert payload["username"] == "new_user"
    assert payload["full_name"] == "New User"
    assert payload["id"] is not None

    db_user = await crud_user.get_by_email(db_session, email="new-user@example.com")
    assert db_user is not None
    assert db_user.hashed_password != "secret123"


@pytest.mark.asyncio
async def test_register_user_rejects_duplicate_email(
    api_client, db_session: AsyncSession
):
    client, _ = api_client
    await _create_user(
        db_session,
        email="duplicate@example.com",
        username="duplicate_user",
        password="secret123",
    )

    response = await client.post(
        "/api/v1/users/",
        json={
            "email": "duplicate@example.com",
            "password": "secret456",
            "full_name": "Other User",
            "username": "other_user",
            "is_superuser": False,
        },
    )

    assert response.status_code == 400
    assert (
        response.json()["detail"]
        == "The user with this email already exists in the system."
    )


@pytest.mark.asyncio
async def test_login_accepts_email_and_username_and_returns_token(
    api_client, db_session: AsyncSession
):
    client, _ = api_client
    await _create_user(
        db_session,
        email="login@example.com",
        username="login_user",
        password="secret123",
    )

    for identifier in ["login@example.com", "login_user"]:
        response = await client.post(
            "/api/v1/login/access-token",
            data={"username": identifier, "password": "secret123"},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )

        assert response.status_code == 200
        payload = response.json()
        assert payload["access_token"]
        assert payload["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_rejects_bad_password(api_client, db_session: AsyncSession):
    client, _ = api_client
    await _create_user(
        db_session,
        email="badpass@example.com",
        username="badpass_user",
        password="secret123",
    )

    response = await client.post(
        "/api/v1/login/access-token",
        data={"username": "badpass@example.com", "password": "wrong-password"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Incorrect email/username or password"


@pytest.mark.asyncio
async def test_users_me_requires_valid_jwt(api_client, db_session: AsyncSession):
    client, _ = api_client
    await _create_user(
        db_session,
        email="me@example.com",
        username="me_user",
        password="secret123",
    )

    login_response = await client.post(
        "/api/v1/login/access-token",
        data={"username": "me@example.com", "password": "secret123"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    token = login_response.json()["access_token"]

    app.dependency_overrides.pop(deps.get_current_user, None)

    response = await client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["email"] == "me@example.com"
    assert payload["username"] == "me_user"
