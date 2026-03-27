from typing import List, Optional

from app.core.security import get_password_hash
from app.models.user import User
from app.schemas.user import UserCreate
from sqlalchemy import or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select


async def get_by_email(db: AsyncSession, email: str) -> Optional[User]:
    result = await db.execute(select(User).filter(User.email == email))
    return result.scalars().first()


async def search_users(
    db: AsyncSession, *, query: str, limit: int = 10, current_user_id: int
) -> List[User]:
    stmt = (
        select(User)
        .filter(
            or_(
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
    db_obj = User(
        email=obj_in.email,
        hashed_password=get_password_hash(obj_in.password),
        full_name=obj_in.full_name,
        is_superuser=obj_in.is_superuser,
    )
    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    return db_obj
