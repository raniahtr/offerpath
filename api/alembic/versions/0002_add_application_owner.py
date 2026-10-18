"""add user_id owner to applications

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-18
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Rows created before sign-in existed have no owner, and with every query scoped to the
    # signed-in user nobody could ever see them again. Only local dev (fake) data exists at
    # this point, so they are deleted rather than assigned to an arbitrary account.
    op.execute("DELETE FROM applications")
    op.add_column("applications", sa.Column("user_id", sa.String(length=255), nullable=False))
    op.create_index(op.f("ix_applications_user_id"), "applications", ["user_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_applications_user_id"), table_name="applications")
    op.drop_column("applications", "user_id")
