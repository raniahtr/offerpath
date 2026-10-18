import datetime as dt

from pydantic import BaseModel, ConfigDict, Field

POSTING_MAX_CHARS = 20_000


class PostingCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str = Field(min_length=1, max_length=200)
    company: str = Field(min_length=1, max_length=200)
    location: str | None = Field(default=None, max_length=200)
    url: str | None = Field(default=None, max_length=2000)
    description: str = Field(min_length=1, max_length=POSTING_MAX_CHARS)


class PostingRead(PostingCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: dt.datetime
