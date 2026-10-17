import datetime as dt

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.application import ApplicationStatus


class _ApplicationFields(BaseModel):
    # Strip surrounding whitespace so "   " fails min_length like an empty string.
    model_config = ConfigDict(str_strip_whitespace=True)


class ApplicationCreate(_ApplicationFields):
    company: str = Field(min_length=1, max_length=200)
    role: str = Field(min_length=1, max_length=200)
    url: str | None = Field(default=None, max_length=2000)
    status: ApplicationStatus = ApplicationStatus.SAVED
    applied_at: dt.date | None = None
    deadline: dt.date | None = None
    notes: str | None = None
    cv_version: str | None = Field(default=None, max_length=100)


class ApplicationUpdate(_ApplicationFields):
    """PATCH body: every field optional; only fields that are sent get updated."""

    company: str | None = Field(default=None, min_length=1, max_length=200)
    role: str | None = Field(default=None, min_length=1, max_length=200)
    url: str | None = Field(default=None, max_length=2000)
    status: ApplicationStatus | None = None
    applied_at: dt.date | None = None
    deadline: dt.date | None = None
    notes: str | None = None
    cv_version: str | None = Field(default=None, max_length=100)

    @field_validator("company", "role", "status")
    @classmethod
    def not_null(cls, value: object) -> object:
        # Omitting these is fine, but explicitly sending null would violate NOT NULL.
        if value is None:
            raise ValueError("may be omitted but not null")
        return value


class ApplicationRead(ApplicationCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: dt.datetime
    updated_at: dt.datetime
