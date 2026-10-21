import datetime as dt
from typing import Annotated

from fastapi import APIRouter, Depends, Response
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.auth import CurrentUserId
from app.db import get_db
from app.models import Application, CvProfile, FitAnalysis, LlmCall, Posting

router = APIRouter(prefix="/me", tags=["me"])

DbSession = Annotated[Session, Depends(get_db)]


@router.delete("", status_code=204)
def delete_my_data(db: DbSession, user_id: CurrentUserId) -> Response:
    """Erase everything stored about the signed-in user (GDPR / nFADP right to erasure).

    Exception: usage counts from the last 24 h stay until they expire. They hold no content,
    and keeping them stops "delete everything" from being a way around the daily AI limit.
    """
    for model in (FitAnalysis, Posting, CvProfile, Application):
        db.execute(delete(model).where(model.user_id == user_id))
    day_ago = dt.datetime.now(dt.UTC) - dt.timedelta(days=1)
    db.execute(delete(LlmCall).where(LlmCall.user_id == user_id, LlmCall.created_at <= day_ago))
    db.commit()
    return Response(status_code=204)
