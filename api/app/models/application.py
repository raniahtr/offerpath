import datetime as dt
from enum import StrEnum

from sqlalchemy import CheckConstraint, Date, DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class ApplicationStatus(StrEnum):
    SAVED = "saved"
    APPLIED = "applied"
    INTERVIEW = "interview"
    OFFER = "offer"
    REJECTED = "rejected"


_STATUS_VALUES = ", ".join(f"'{s.value}'" for s in ApplicationStatus)


class Application(Base):
    __tablename__ = "applications"
    __table_args__ = (CheckConstraint(f"status IN ({_STATUS_VALUES})", name="status_valid"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    company: Mapped[str] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(200))
    url: Mapped[str | None] = mapped_column(String(2000))
    status: Mapped[str] = mapped_column(
        String(20), default=ApplicationStatus.SAVED, server_default=ApplicationStatus.SAVED
    )
    applied_at: Mapped[dt.date | None] = mapped_column(Date)
    deadline: Mapped[dt.date | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)
    cv_version: Mapped[str | None] = mapped_column(String(100))
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
