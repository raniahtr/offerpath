import datetime as dt
from enum import StrEnum

from sqlalchemy import CheckConstraint, DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class CvFormat(StrEnum):
    LATEX = "latex"
    TEXT = "text"
    PDF = "pdf"  # text extracted from an uploaded PDF (the PDF itself is never stored)


_FORMAT_VALUES = ", ".join(f"'{f.value}'" for f in CvFormat)


class CvProfile(Base):
    """A user's CV: personal data, only ever read for its owner and deleted with the account."""

    __tablename__ = "cv_profiles"
    __table_args__ = (CheckConstraint(f"format IN ({_FORMAT_VALUES})", name="format_valid"),)

    # One CV per user, so the user id is the primary key.
    user_id: Mapped[str] = mapped_column(String(255), primary_key=True)
    content: Mapped[str] = mapped_column(Text)
    format: Mapped[str] = mapped_column(String(10))
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
