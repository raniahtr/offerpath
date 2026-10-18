from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import CurrentUserId
from app.db import get_db
from app.models import Application, ApplicationStatus
from app.schemas.application import ApplicationCreate, ApplicationRead, ApplicationUpdate

router = APIRouter(prefix="/applications", tags=["applications"])

DbSession = Annotated[Session, Depends(get_db)]


def _get_owned_or_404(db: Session, application_id: int, user_id: str) -> Application:
    application = db.get(Application, application_id)
    # Someone else's application is reported exactly like a missing one (404, not 403),
    # so ids can't be probed to learn which applications exist.
    if application is None or application.user_id != user_id:
        raise HTTPException(status_code=404, detail="Application not found")
    return application


@router.get("", response_model=list[ApplicationRead])
def list_applications(
    db: DbSession, user_id: CurrentUserId, status: ApplicationStatus | None = None
) -> list[Application]:
    stmt = (
        select(Application)
        .where(Application.user_id == user_id)
        .order_by(Application.created_at.desc(), Application.id.desc())
    )
    if status is not None:
        stmt = stmt.where(Application.status == status)
    return list(db.scalars(stmt))


@router.post("", response_model=ApplicationRead, status_code=201)
def create_application(
    payload: ApplicationCreate, db: DbSession, user_id: CurrentUserId
) -> Application:
    # The owner always comes from the verified token, never from the request body.
    application = Application(**payload.model_dump(), user_id=user_id)
    db.add(application)
    db.commit()
    db.refresh(application)
    return application


@router.get("/{application_id}", response_model=ApplicationRead)
def get_application(application_id: int, db: DbSession, user_id: CurrentUserId) -> Application:
    return _get_owned_or_404(db, application_id, user_id)


@router.patch("/{application_id}", response_model=ApplicationRead)
def update_application(
    application_id: int, payload: ApplicationUpdate, db: DbSession, user_id: CurrentUserId
) -> Application:
    application = _get_owned_or_404(db, application_id, user_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(application, field, value)
    db.commit()
    db.refresh(application)
    return application


@router.delete("/{application_id}", status_code=204)
def delete_application(application_id: int, db: DbSession, user_id: CurrentUserId) -> Response:
    db.delete(_get_owned_or_404(db, application_id, user_id))
    db.commit()
    return Response(status_code=204)
