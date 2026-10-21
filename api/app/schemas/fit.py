import datetime as dt

from pydantic import BaseModel, ConfigDict, Field

from app.models.fit_analysis import AnalysisSource


class FitResult(BaseModel):
    """What the LLM must return. Also sent to the provider as the JSON schema to follow."""

    # extra="forbid" -> "additionalProperties": false, which strict JSON-schema mode requires.
    model_config = ConfigDict(extra="forbid")

    score: int = Field(ge=0, le=100, description="How well the CV fits the posting, 0-100.")
    matched_skills: list[str] = Field(
        max_length=30, description="Skills the posting asks for that the CV demonstrates."
    )
    missing_skills: list[str] = Field(
        max_length=30, description="Skills the posting asks for that the CV does not show."
    )
    explanation: str = Field(
        max_length=2000, description="2-4 sentences: why this score, addressed to the candidate."
    )


class FitAnalysisRead(FitResult):
    model_config = ConfigDict(from_attributes=True, extra="ignore")

    id: int
    posting_id: int
    source: AnalysisSource
    model: str | None
    created_at: dt.datetime


class ManualPrompt(BaseModel):
    """The full prompt, for users who run it in their own ChatGPT/Claude chat."""

    prompt: str


class ManualAnswer(BaseModel):
    """The answer the user pasted back from their own chat (validated before saving)."""

    answer: str = Field(min_length=1, max_length=20_000)
