import secrets
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.core.dependencies import require_role, get_client_ip
from app.core.rbac import Role
from app.core.security import hash_password
from app.models.oauth_client import OAuthClient
from app.schemas.oauth_client import (
    OAuthClientCreate,
    OAuthClientUpdate,
    OAuthClientResponse,
    OAuthClientCreatedResponse,
    OAuthClientSecretResponse,
)
from app.services.audit_service import create_audit_log

router = APIRouter(prefix="/api/v1/oauth-clients", tags=["oauth-clients"])


@router.get("", response_model=list[OAuthClientResponse])
async def list_oauth_clients(
    current_user=Depends(require_role(Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> list[OAuthClientResponse]:
    result = await db.execute(
        select(OAuthClient).order_by(OAuthClient.created_at)
    )
    return result.scalars().all()


@router.post("", response_model=OAuthClientCreatedResponse, status_code=201)
async def create_oauth_client(
    body: OAuthClientCreate,
    request: Request,
    current_user=Depends(require_role(Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> OAuthClientCreatedResponse:
    # Enforce unique name
    existing = await db.execute(
        select(OAuthClient).where(OAuthClient.name == body.name)
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="Een applicatie met deze naam bestaat al")

    plain_secret = secrets.token_hex(32)
    client = OAuthClient(
        client_id=str(uuid.uuid4()),
        client_secret_hash=hash_password(plain_secret),
        name=body.name,
        redirect_uris=body.redirect_uris,
        allowed_scopes=body.allowed_scopes,
        is_active=True,
    )
    db.add(client)
    await db.flush()

    await create_audit_log(
        db, "oauth_client", client.client_id, "CREATE",
        actor_user_id=current_user.id,
        metadata={"name": client.name},
        ip_address=get_client_ip(request),
    )

    return OAuthClientCreatedResponse(
        client_id=client.client_id,
        client_secret=plain_secret,
        name=client.name,
        redirect_uris=client.redirect_uris,
        allowed_scopes=client.allowed_scopes,
        is_active=client.is_active,
        created_at=client.created_at,
        updated_at=client.updated_at,
    )


@router.patch("/{client_id}", response_model=OAuthClientResponse)
async def update_oauth_client(
    client_id: str,
    body: OAuthClientUpdate,
    request: Request,
    current_user=Depends(require_role(Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> OAuthClientResponse:
    result = await db.execute(
        select(OAuthClient).where(OAuthClient.client_id == client_id)
    )
    client = result.scalar_one_or_none()
    if client is None:
        raise HTTPException(status_code=404, detail="Applicatie niet gevonden")

    updates = body.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(client, field, value)
    await db.flush()

    await create_audit_log(
        db, "oauth_client", client_id, "UPDATE",
        actor_user_id=current_user.id,
        metadata=updates,
        ip_address=get_client_ip(request),
    )
    return client


@router.delete("/{client_id}", status_code=204)
async def delete_oauth_client(
    client_id: str,
    request: Request,
    current_user=Depends(require_role(Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        select(OAuthClient).where(OAuthClient.client_id == client_id)
    )
    client = result.scalar_one_or_none()
    if client is None:
        raise HTTPException(status_code=404, detail="Applicatie niet gevonden")

    await db.delete(client)
    await create_audit_log(
        db, "oauth_client", client_id, "DELETE",
        actor_user_id=current_user.id,
        ip_address=get_client_ip(request),
    )


@router.post("/{client_id}/regenerate-secret", response_model=OAuthClientSecretResponse)
async def regenerate_secret(
    client_id: str,
    request: Request,
    current_user=Depends(require_role(Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> OAuthClientSecretResponse:
    result = await db.execute(
        select(OAuthClient).where(OAuthClient.client_id == client_id)
    )
    client = result.scalar_one_or_none()
    if client is None:
        raise HTTPException(status_code=404, detail="Applicatie niet gevonden")

    plain_secret = secrets.token_hex(32)
    client.client_secret_hash = hash_password(plain_secret)
    await db.flush()

    await create_audit_log(
        db, "oauth_client", client_id, "REGENERATE_SECRET",
        actor_user_id=current_user.id,
        ip_address=get_client_ip(request),
    )

    return OAuthClientSecretResponse(client_id=client_id, client_secret=plain_secret)
