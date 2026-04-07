from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.core.security import decode_token, timing_safe_compare
from app.core.rbac import Role
from app.config import get_settings
from app.models.business_settings import BusinessSettings

security_scheme = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
):
    from app.models.user import User

    token = credentials.credentials
    payload = decode_token(token)
    if payload is None or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    result = await db.execute(select(User).where(User.id == user_id, User.is_active == True))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )
    return user


def require_role(*roles: Role):
    async def role_checker(current_user=Depends(get_current_user)):
        role_values = [r.value for r in roles]
        if current_user.role not in role_values:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user
    return role_checker


async def get_current_admin(current_user=Depends(get_current_user)):
    if current_user.role != Role.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


async def verify_external_api_key(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
) -> bool:
    settings = get_settings()
    if not settings.EXTERNAL_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="External API not configured",
        )
    if not timing_safe_compare(credentials.credentials, settings.EXTERNAL_API_KEY):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
        )
    return True


def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def get_business_settings(db: AsyncSession = Depends(get_db)) -> BusinessSettings:
    """Fetch the single BusinessSettings row. Raises 503 if not configured."""
    result = await db.execute(select(BusinessSettings).limit(1))
    settings = result.scalar_one_or_none()
    if not settings:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Business settings not configured",
        )
    return settings
