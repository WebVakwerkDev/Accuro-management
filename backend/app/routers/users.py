from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.core.dependencies import require_role, get_client_ip
from app.core.rbac import Role
from app.core.security import hash_password
from app.core.auth import invalidate_all_user_tokens
from app.services.audit_service import create_audit_log
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate, UserResponse

router = APIRouter(prefix="/api/v1/users", tags=["users"])


@router.get("", response_model=list[UserResponse])
async def list_users(
    current_user: User = Depends(require_role(Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    return result.scalars().all()


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    body: UserCreate,
    request: Request,
    current_user: User = Depends(require_role(Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(select(User).where(User.email == body.email.lower().strip()))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(
        name=body.name.strip(),
        email=body.email.lower().strip(),
        password_hash=hash_password(body.password),
        role=body.role.value,
    )
    db.add(user)
    await db.flush()

    await create_audit_log(
        db, "User", user.id, "CREATE",
        actor_user_id=current_user.id,
        metadata={"name": user.name, "email": user.email, "role": user.role},
        ip_address=get_client_ip(request),
    )
    return user


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    current_user: User = Depends(require_role(Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    body: UserUpdate,
    request: Request,
    current_user: User = Depends(require_role(Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    changes = {}
    if body.name is not None:
        changes["name"] = {"old": user.name, "new": body.name}
        user.name = body.name
    if body.role is not None:
        changes["role"] = {"old": user.role, "new": body.role.value}
        user.role = body.role.value
    if body.is_active is not None:
        changes["is_active"] = {"old": user.is_active, "new": body.is_active}
        user.is_active = body.is_active
        if not body.is_active:
            await invalidate_all_user_tokens(user.id)

    if changes:
        await db.flush()
        await db.refresh(user)
        await create_audit_log(
            db, "User", user.id, "UPDATE",
            actor_user_id=current_user.id,
            metadata=changes,
            ip_address=get_client_ip(request),
        )
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    request: Request,
    current_user: User = Depends(require_role(Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete yourself")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.is_active = False
    db.add(user)
    await invalidate_all_user_tokens(user.id)

    await create_audit_log(
        db, "User", user.id, "DEACTIVATE",
        actor_user_id=current_user.id,
        metadata={"name": user.name},
        ip_address=get_client_ip(request),
    )
