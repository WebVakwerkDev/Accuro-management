"""Add category column to expenses

Revision ID: 008
Revises: 007
Create Date: 2026-03-26
"""
from alembic import op
import sqlalchemy as sa

revision = '008'
down_revision = '007'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('expenses', sa.Column('category', sa.String(50), nullable=True))


def downgrade() -> None:
    op.drop_column('expenses', 'category')
