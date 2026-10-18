from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import CurrentUserId
from app.config import get_settings
from app.db import get_db
from app.models import AnalysisSource, CvProfile, FitAnalysis, Posting
from app.schemas.fit import FitAnalysisRead, FitResult, ManualAnswer, ManualPrompt
from app.schemas.posting import PostingCreate, PostingRead
from app.services import fit
from app.services.cv_text import cv_prompt_text
from app.services.llm import LlmClient, generate, get_llm_client
from app.services.quota import ensure_quota, record_call

router = APIRouter(prefix="/postings", tags=["postings"])

DbSession = Annotated[Session, Depends(get_db)]
Llm = Annotated[LlmClient, Depends(get_llm_client)]


def _get_owned_or_404(db: Session, posting_id: int, user_id: str) -> Posting:
    posting = db.get(Posting, posting_id)
    # Same rule as applications: someone else's posting looks exactly like a missing one.
    if posting is None or posting.user_id != user_id:
        raise HTTPException(status_code=404, detail="Posting not found")
    return posting


def _cv_text_or_409(db: Session, user_id: str) -> str:
    cv = db.get(CvProfile, user_id)
    if cv is None:
        raise HTTPException(status_code=409, detail="Add your CV first")
    return cv_prompt_text(cv.content, cv.format)


@router.get("", response_model=list[PostingRead])
def list_postings(db: DbSession, user_id: CurrentUserId) -> list[Posting]:
    stmt = (
        select(Posting)
        .where(Posting.user_id == user_id)
        .order_by(Posting.created_at.desc(), Posting.id.desc())
    )
    return list(db.scalars(stmt))


@router.post("", response_model=PostingRead, status_code=201)
def create_posting(payload: PostingCreate, db: DbSession, user_id: CurrentUserId) -> Posting:
    posting = Posting(**payload.model_dump(), user_id=user_id)
    db.add(posting)
    db.commit()
    db.refresh(posting)
    return posting


@router.get("/{posting_id}", response_model=PostingRead)
def get_posting(posting_id: int, db: DbSession, user_id: CurrentUserId) -> Posting:
    return _get_owned_or_404(db, posting_id, user_id)


@router.delete("/{posting_id}", status_code=204)
def delete_posting(posting_id: int, db: DbSession, user_id: CurrentUserId) -> Response:
    db.delete(_get_owned_or_404(db, posting_id, user_id))  # its analyses go with it (CASCADE)
    db.commit()
    return Response(status_code=204)


@router.get("/{posting_id}/fit", response_model=FitAnalysisRead)
def get_latest_fit(posting_id: int, db: DbSession, user_id: CurrentUserId) -> FitAnalysis:
    posting = _get_owned_or_404(db, posting_id, user_id)
    stmt = (
        select(FitAnalysis)
        .where(FitAnalysis.posting_id == posting.id)
        .order_by(FitAnalysis.id.desc())
        .limit(1)
    )
    analysis = db.scalar(stmt)
    if analysis is None:
        raise HTTPException(status_code=404, detail="No analysis yet")
    return analysis


@router.post("/{posting_id}/fit", response_model=FitAnalysisRead, status_code=201)
def analyze_fit(
    posting_id: int, response: Response, db: DbSession, user_id: CurrentUserId, llm: Llm
) -> FitAnalysis:
    """Runs the in-app LLM. Identical inputs return the stored analysis (200, no LLM call)."""
    posting = _get_owned_or_404(db, posting_id, user_id)
    cv_text = _cv_text_or_409(db, user_id)

    key = fit.input_hash(cv_text, posting, llm.model)
    cached = db.scalar(
        select(FitAnalysis)
        .where(
            FitAnalysis.user_id == user_id,
            FitAnalysis.posting_id == posting.id,
            FitAnalysis.input_hash == key,
        )
        .order_by(FitAnalysis.id.desc())
        .limit(1)
    )
    if cached is not None:
        response.status_code = 200
        return cached

    ensure_quota(db, user_id, get_settings().llm_daily_limit_per_user)
    result = generate(
        llm,
        system=fit.SYSTEM_PROMPT,
        user=fit.user_message(cv_text, posting),
        schema=FitResult,
        on_call=lambda c: record_call(
            db, user_id=user_id, kind="fit_analysis", model=llm.model, completion=c
        ),
    )
    return _save(db, user_id, posting, result, AnalysisSource.API, llm.model, key)


@router.get("/{posting_id}/fit/prompt", response_model=ManualPrompt)
def get_manual_prompt(posting_id: int, db: DbSession, user_id: CurrentUserId) -> ManualPrompt:
    """The full prompt, to run in the user's own ChatGPT/Claude chat (free, no limit)."""
    posting = _get_owned_or_404(db, posting_id, user_id)
    return ManualPrompt(prompt=fit.manual_prompt(_cv_text_or_409(db, user_id), posting))


@router.post("/{posting_id}/fit/manual", response_model=FitAnalysisRead, status_code=201)
def save_manual_answer(
    posting_id: int, payload: ManualAnswer, db: DbSession, user_id: CurrentUserId
) -> FitAnalysis:
    """Validates and stores the answer the user pasted back from their own chat."""
    posting = _get_owned_or_404(db, posting_id, user_id)
    cv_text = _cv_text_or_409(db, user_id)
    try:
        result = fit.parse_manual_answer(payload.answer)
    except fit.InvalidAnswerError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    key = fit.input_hash(cv_text, posting, "manual")
    return _save(db, user_id, posting, result, AnalysisSource.MANUAL, None, key)


def _save(
    db: Session,
    user_id: str,
    posting: Posting,
    result: FitResult,
    source: AnalysisSource,
    model: str | None,
    key: str,
) -> FitAnalysis:
    analysis = FitAnalysis(
        **result.model_dump(),
        user_id=user_id,
        posting_id=posting.id,
        source=source,
        model=model,
        input_hash=key,
    )
    db.add(analysis)
    db.commit()
    db.refresh(analysis)
    return analysis
