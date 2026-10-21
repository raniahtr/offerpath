"""Per-user limit on LLM calls over a rolling 24 hours (the provider's free tier is shared)."""

import datetime as dt

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import LlmCall
from app.services.llm import Completion


class QuotaExceededError(Exception):
    def __init__(self, limit: int) -> None:
        super().__init__(f"Daily AI limit of {limit} reached")
        self.limit = limit


def calls_in_last_day(db: Session, user_id: str) -> int:
    since = dt.datetime.now(dt.UTC) - dt.timedelta(days=1)
    stmt = select(func.count()).where(LlmCall.user_id == user_id, LlmCall.created_at > since)
    return db.scalar(stmt) or 0


def ensure_quota(db: Session, user_id: str, limit: int) -> None:
    if calls_in_last_day(db, user_id) >= limit:
        raise QuotaExceededError(limit)


def record_call(
    db: Session, *, user_id: str, kind: str, model: str, completion: Completion
) -> None:
    # Committed right away: a call counts even if a later step of the request fails.
    db.add(
        LlmCall(
            user_id=user_id,
            kind=kind,
            model=model,
            input_tokens=completion.input_tokens,
            output_tokens=completion.output_tokens,
        )
    )
    db.commit()
