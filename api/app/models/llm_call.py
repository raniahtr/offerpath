import datetime as dt

from sqlalchemy import DateTime, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class LlmCall(Base):
    """One request to the LLM provider: drives the per-user daily limit and shows usage.

    Stores counts only, never prompt or answer text (those contain the user's CV).
    """

    __tablename__ = "llm_calls"
    __table_args__ = (Index("ix_llm_calls_user_id_created_at", "user_id", "created_at"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[str] = mapped_column(String(255))
    kind: Mapped[str] = mapped_column(String(30))  # e.g. "fit_analysis"
    model: Mapped[str] = mapped_column(String(100))
    input_tokens: Mapped[int] = mapped_column(Integer)
    output_tokens: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
