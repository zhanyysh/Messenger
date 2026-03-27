from datetime import datetime, timezone
from typing import List, Optional

from app.core.security import get_password_hash
from app.models.user import User
from app.schemas.user import UserCreate, UserProfileUpdate
from sqlalchemy import or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select


async def get_by_email(db: AsyncSession, email: str) -> Optional[User]:
    result = await db.execute(select(User).filter(User.email == email))
    return result.scalars().first()


async def get_by_username(db: AsyncSession, username: str) -> Optional[User]:
    result = await db.execute(select(User).filter(User.username == username))
    return result.scalars().first()


async def search_users(
    db: AsyncSession, *, query: str, limit: int = 10, current_user_id: int
) -> List[User]:
    stmt = (
        select(User)
        .filter(
            or_(
                User.username.ilike(f"%{query}%"),
                User.email.ilike(f"%{query}%"),
                User.full_name.ilike(f"%{query}%"),
            ),
            User.id != current_user_id,
        )
        .limit(limit)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


async def create(db: AsyncSession, obj_in: UserCreate) -> User:
    normalized_username = obj_in.username.strip() if obj_in.username else None
    db_obj = User(
        email=obj_in.email,
        username=normalized_username,
        hashed_password=get_password_hash(obj_in.password),
        full_name=obj_in.full_name,
        bio=obj_in.bio,
        avatar_url=obj_in.avatar_url,
        is_superuser=obj_in.is_superuser,
    )
    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    return db_obj


async def update_profile(
    db: AsyncSession,
    *,
    db_obj: User,
    profile_in: UserProfileUpdate,
) -> User:
    if profile_in.username is not None:
        db_obj.username = profile_in.username.strip() or None
    if profile_in.full_name is not None:
        db_obj.full_name = profile_in.full_name.strip() or None
    if profile_in.bio is not None:
        db_obj.bio = profile_in.bio.strip() or None
    if profile_in.avatar_url is not None:
        db_obj.avatar_url = profile_in.avatar_url.strip() or None

    await db.commit()
    await db.refresh(db_obj)
    return db_obj


async def touch_last_seen(db: AsyncSession, db_obj: User) -> None:
    db_obj.last_seen = datetime.now(timezone.utc).replace(tzinfo=None)
    await db.commit()
