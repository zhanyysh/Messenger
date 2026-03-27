from typing import Any, List

from app.api import deps
from app.crud import crud_user
from app.schemas.user import User, UserCreate, UserProfileUpdate
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


@router.get("/search", response_model=List[User])
async def search_users(
    query: str = Query(..., min_length=1),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Search for users by username, email or full name.
    """
    users = await crud_user.search_users(
        db, query=query, current_user_id=current_user.id
    )
    return users


@router.post("/", response_model=User)
async def create_user(
    *,
    db: AsyncSession = Depends(deps.get_db),
    user_in: UserCreate,
) -> Any:
    """
    Create new user.
    """
    user = await crud_user.get_by_email(db, email=user_in.email)
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this email already exists in the system.",
        )

    if user_in.username:
        user_by_username = await crud_user.get_by_username(
            db, username=user_in.username
        )
        if user_by_username:
            raise HTTPException(status_code=400, detail="Username is already taken.")

    user = await crud_user.create(db, obj_in=user_in)
    return user


@router.get("/me", response_model=User)
async def read_user_me(
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Get current user profile (Requires Authentication).
    """
    return current_user


@router.patch("/me", response_model=User)
async def update_user_me(
    *,
    db: AsyncSession = Depends(deps.get_db),
    profile_in: UserProfileUpdate,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Update current user profile fields.
    """
    if profile_in.username is not None:
        normalized_username = profile_in.username.strip() or None
        if normalized_username:
            user_by_username = await crud_user.get_by_username(
                db, username=normalized_username
            )
            if user_by_username and user_by_username.id != current_user.id:
                raise HTTPException(
                    status_code=400, detail="Username is already taken."
                )

    updated_user = await crud_user.update_profile(
        db,
        db_obj=current_user,
        profile_in=profile_in,
    )
    return updated_user
