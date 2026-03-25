"""add tasks table

Revision ID: 003
Revises: 002
Create Date: 2026-03-25
"""
from alembic import op
import sqlalchemy as sa

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def _create_enum_if_not_exists(name: str, values: list[str]) -> None:
    values_str = ", ".join(f"'{v}'" for v in values)
    op.execute(sa.text(
        f"DO $$ BEGIN "
        f"CREATE TYPE {name} AS ENUM ({values_str}); "
        f"EXCEPTION WHEN duplicate_object THEN null; "
        f"END $$"
    ))


def upgrade() -> None:
    _create_enum_if_not_exists("task_status", ["TODO", "IN_PROGRESS", "DONE"])

    from sqlalchemy.dialects import postgresql
    task_status = postgresql.ENUM("TODO", "IN_PROGRESS", "DONE", name="task_status", create_type=False)

    op.create_table(
        "tasks",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("project_id", sa.String(36), sa.ForeignKey("project_workspaces.id"), nullable=True, index=True),
        sa.Column("assigned_to_user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("status", task_status, nullable=False, server_default="TODO"),
        sa.Column("deadline", sa.Date(), nullable=True, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("tasks")
    op.execute(sa.text("DROP TYPE IF EXISTS task_status"))
