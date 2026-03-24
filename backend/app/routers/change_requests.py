from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone

from app.database import get_db
from app.core.dependencies import require_role, get_client_ip
from app.core.rbac import Role
from app.core.security import sanitize_html
from app.services.audit_service import create_audit_log
from app.models.change_request import ChangeRequest, ChangeRequestStatus
from app.models.project import ProjectWorkspace
from app.schemas.change_request import ChangeRequestCreate, ChangeRequestUpdate, ChangeRequestResponse

router = APIRouter(prefix="/api/v1", tags=["change-requests"])


@router.get("/projects/{project_id}/change-requests", response_model=list[ChangeRequestResponse])
async def list_change_requests(
    project_id: str,
    current_user=Depends(require_role(Role.ADMIN, Role.EMPLOYEE)),
    db: AsyncSession = Depends(get_db),
):
    project = await db.execute(
        select(ProjectWorkspace).where(ProjectWorkspace.id == project_id, ProjectWorkspace.deleted_at.is_(None))
    )
    if not project.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    result = await db.execute(
        select(ChangeRequest)
        .where(ChangeRequest.project_id == project_id)
        .order_by(ChangeRequest.created_at.desc())
    )
    return [ChangeRequestResponse.model_validate(cr) for cr in result.scalars().all()]


@router.post("/projects/{project_id}/change-requests", response_model=ChangeRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_change_request(
    project_id: str,
    body: ChangeRequestCreate,
    request: Request,
    current_user=Depends(require_role(Role.ADMIN, Role.EMPLOYEE)),
    db: AsyncSession = Depends(get_db),
):
    project = await db.execute(
        select(ProjectWorkspace).where(ProjectWorkspace.id == project_id, ProjectWorkspace.deleted_at.is_(None))
    )
    if not project.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    cr = ChangeRequest(
        project_id=project_id,
        title=body.title,
        description=sanitize_html(body.description),
        source_type=body.source_type.value,
        status=body.status.value,
        impact=body.impact.value,
        github_issue_url=body.github_issue_url,
        github_branch=body.github_branch,
        github_pr_url=body.github_pr_url,
        created_by_user_id=current_user.id,
        assigned_to_user_id=body.assigned_to_user_id,
    )
    db.add(cr)
    await db.flush()

    await create_audit_log(
        db, "ChangeRequest", cr.id, "CREATE",
        actor_user_id=current_user.id,
        metadata={"project_id": project_id, "title": cr.title},
        ip_address=get_client_ip(request),
    )
    return ChangeRequestResponse.model_validate(cr)


@router.get("/change-requests/{cr_id}", response_model=ChangeRequestResponse)
async def get_change_request(
    cr_id: str,
    current_user=Depends(require_role(Role.ADMIN, Role.EMPLOYEE)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ChangeRequest).where(ChangeRequest.id == cr_id))
    cr = result.scalar_one_or_none()
    if not cr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Change request not found")
    return ChangeRequestResponse.model_validate(cr)


@router.patch("/change-requests/{cr_id}", response_model=ChangeRequestResponse)
async def update_change_request(
    cr_id: str,
    body: ChangeRequestUpdate,
    request: Request,
    current_user=Depends(require_role(Role.ADMIN, Role.EMPLOYEE)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ChangeRequest).where(ChangeRequest.id == cr_id))
    cr = result.scalar_one_or_none()
    if not cr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Change request not found")

    changes = {}
    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "description" and value:
            value = sanitize_html(value)
        if hasattr(value, "value"):
            value = value.value
        old_value = getattr(cr, field)
        if old_value != value:
            changes[field] = {"old": str(old_value), "new": str(value)}
            setattr(cr, field, value)

    if changes:
        await db.flush()
        await db.refresh(cr)
        action = "STATUS_CHANGE" if "status" in changes else "UPDATE"
        await create_audit_log(
            db, "ChangeRequest", cr.id, action,
            actor_user_id=current_user.id,
            metadata=changes,
            ip_address=get_client_ip(request),
        )
    return ChangeRequestResponse.model_validate(cr)


@router.post("/change-requests/{cr_id}/reopen", response_model=ChangeRequestResponse)
async def reopen_change_request(
    cr_id: str,
    request: Request,
    current_user=Depends(require_role(Role.ADMIN, Role.EMPLOYEE)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ChangeRequest).where(ChangeRequest.id == cr_id))
    cr = result.scalar_one_or_none()
    if not cr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Change request not found")

    old_status = cr.status
    cr.status = ChangeRequestStatus.NEW.value
    cr.reopened_count += 1
    cr.closed_at = None
    db.add(cr)

    await create_audit_log(
        db, "ChangeRequest", cr.id, "REOPEN",
        actor_user_id=current_user.id,
        metadata={"old_status": old_status, "reopened_count": cr.reopened_count},
        ip_address=get_client_ip(request),
    )
    return ChangeRequestResponse.model_validate(cr)


@router.post("/change-requests/{cr_id}/close", response_model=ChangeRequestResponse)
async def close_change_request(
    cr_id: str,
    request: Request,
    current_user=Depends(require_role(Role.ADMIN, Role.EMPLOYEE)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ChangeRequest).where(ChangeRequest.id == cr_id))
    cr = result.scalar_one_or_none()
    if not cr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Change request not found")

    old_status = cr.status
    cr.status = ChangeRequestStatus.DONE.value
    cr.closed_at = datetime.now(timezone.utc)
    db.add(cr)

    await create_audit_log(
        db, "ChangeRequest", cr.id, "CLOSE",
        actor_user_id=current_user.id,
        metadata={"old_status": old_status},
        ip_address=get_client_ip(request),
    )
    return ChangeRequestResponse.model_validate(cr)
