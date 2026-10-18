"""add cv profiles, postings, fit analyses and llm call log

All four tables are per user (user_id from the login token). New tables only, so upgrading
touches no existing data.

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-18
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "cv_profiles",
        sa.Column("user_id", sa.String(length=255), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("format", sa.String(length=10), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "format IN ('latex', 'text', 'pdf')", name=op.f("ck_cv_profiles_format_valid")
        ),
        sa.PrimaryKeyConstraint("user_id", name=op.f("pk_cv_profiles")),
    )
    op.create_table(
        "llm_calls",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.String(length=255), nullable=False),
        sa.Column("kind", sa.String(length=30), nullable=False),
        sa.Column("model", sa.String(length=100), nullable=False),
        sa.Column("input_tokens", sa.Integer(), nullable=False),
        sa.Column("output_tokens", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_llm_calls")),
    )
    op.create_index(
        "ix_llm_calls_user_id_created_at", "llm_calls", ["user_id", "created_at"], unique=False
    )
    op.create_table(
        "postings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.String(length=255), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("company", sa.String(length=200), nullable=False),
        sa.Column("location", sa.String(length=200), nullable=True),
        sa.Column("url", sa.String(length=2000), nullable=True),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_postings")),
    )
    op.create_index(op.f("ix_postings_user_id"), "postings", ["user_id"], unique=False)
    op.create_table(
        "fit_analyses",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.String(length=255), nullable=False),
        sa.Column("posting_id", sa.Integer(), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("matched_skills", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("missing_skills", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("explanation", sa.Text(), nullable=False),
        sa.Column("source", sa.String(length=10), nullable=False),
        sa.Column("model", sa.String(length=100), nullable=True),
        sa.Column("input_hash", sa.String(length=64), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "source IN ('api', 'manual')", name=op.f("ck_fit_analyses_source_valid")
        ),
        sa.CheckConstraint("score BETWEEN 0 AND 100", name=op.f("ck_fit_analyses_score_range")),
        sa.ForeignKeyConstraint(
            ["posting_id"],
            ["postings.id"],
            name=op.f("fk_fit_analyses_posting_id_postings"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_fit_analyses")),
    )
    op.create_index(
        op.f("ix_fit_analyses_posting_id"), "fit_analyses", ["posting_id"], unique=False
    )
    op.create_index(
        "ix_fit_analyses_user_id_input_hash",
        "fit_analyses",
        ["user_id", "input_hash"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_fit_analyses_user_id_input_hash", table_name="fit_analyses")
    op.drop_index(op.f("ix_fit_analyses_posting_id"), table_name="fit_analyses")
    op.drop_table("fit_analyses")
    op.drop_index(op.f("ix_postings_user_id"), table_name="postings")
    op.drop_table("postings")
    op.drop_index("ix_llm_calls_user_id_created_at", table_name="llm_calls")
    op.drop_table("llm_calls")
    op.drop_table("cv_profiles")
