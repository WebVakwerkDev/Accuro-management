from pydantic import BaseModel
from datetime import date, datetime


class TaskCreate(BaseModel):
    title: str
    description: str | None = None
    project_id: str | None = None
    deadline: date | None = None


class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    project_id: str | None = None
    status: str | None = None
    deadline: date | None = None


class TaskResponse(BaseModel):
    id: str
    title: str
    description: str | None
    project_id: str | None
    assigned_to_user_id: str | None
    status: str
    deadline: date | None
    created_at: datetime
    updated_at: datetime
    project_name: str | None = None

    model_config = {"from_attributes": True}
