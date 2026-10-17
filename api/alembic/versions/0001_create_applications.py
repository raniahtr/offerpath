"""create applications table

Revision ID: 0001
Revises:
Create Date: 2026-10-17
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # pgvector: not used yet, enabled now to confirm the hosted database supports it.
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.create_table(
        "applications",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("company", sa.String(length=200), nullable=False),
        sa.Column("role", sa.String(length=200), nullable=False),
        sa.Column("url", sa.String(length=2000), nullable=True),
        sa.Column("status", sa.String(length=20), server_default="saved", nullable=False),
        sa.Column("applied_at", sa.Date(), nullable=True),
        sa.Column("deadline", sa.Date(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("cv_version", sa.String(length=100), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint(
            "status IN ('saved', 'applied', 'interview', 'offer', 'rejected')",
            name=op.f("ck_applications_status_valid"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_applications")),
    )


def downgrade() -> None:
    op.drop_table("applications")
    op.execute("DROP EXTENSION IF EXISTS vector")
