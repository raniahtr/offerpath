import datetime as dt

from pydantic import BaseModel, ConfigDict, Field

from app.models.cv_profile import CvFormat

# ~15-20 pages of LaTeX: generous for a CV, small enough to keep LLM prompts bounded.
CV_MAX_CHARS = 50_000


class CvUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    content: str = Field(min_length=1, max_length=CV_MAX_CHARS)
    format: CvFormat = CvFormat.LATEX


class CvRead(CvUpdate):
    model_config = ConfigDict(from_attributes=True)

    updated_at: dt.datetime


class PdfText(BaseModel):
    """Text extracted from an uploaded PDF, returned for review: it is not saved."""

    text: str
    pages: int
