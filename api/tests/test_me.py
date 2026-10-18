import datetime as dt
from collections.abc import Callable

from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Application, CvProfile, FitAnalysis, LlmCall, Posting
from tests.fake_data import FAKE_CV_LATEX, FAKE_POSTING, FIT_JSON

Headers = Callable[[str], dict[str, str]]


def _fill(client: TestClient, headers: dict[str, str] | None = None) -> None:
    client.put("/cv", json={"content": FAKE_CV_LATEX, "format": "latex"}, headers=headers)
    client.post("/applications", json={"company": "Acme", "role": "Intern"}, headers=headers)
    posting_id = client.post("/postings", json=FAKE_POSTING, headers=headers).json()["id"]
    client.post(f"/postings/{posting_id}/fit/manual", json={"answer": FIT_JSON}, headers=headers)


def _count(db: Session, model: type, user_id: str) -> int:
    stmt = select(func.count()).select_from(model).where(model.user_id == user_id)  # type: ignore[attr-defined]
    return db.scalar(stmt) or 0


def test_delete_my_data_erases_everything_of_mine_only(
    client: TestClient, auth_headers: Headers, db_session: Session
) -> None:
    _fill(client)
    _fill(client, auth_headers("user-b"))

    assert client.delete("/me").status_code == 204

    for model in (CvProfile, Application, Posting, FitAnalysis):
        assert _count(db_session, model, "user-a") == 0, model.__name__
        assert _count(db_session, model, "user-b") == 1, model.__name__


def test_recent_usage_counts_survive_to_keep_the_daily_limit(
    client: TestClient, db_session: Session
) -> None:
    old = dt.datetime.now(dt.UTC) - dt.timedelta(days=2)
    for created_at in (old, dt.datetime.now(dt.UTC)):
        db_session.add(
            LlmCall(
                user_id="user-a",
                kind="fit_analysis",
                model="m",
                input_tokens=1,
                output_tokens=1,
                created_at=created_at,
            )
        )
    db_session.commit()

    client.delete("/me")

    assert _count(db_session, LlmCall, "user-a") == 1  # only the recent one is kept


def test_requires_sign_in(anonymous_client: TestClient) -> None:
    assert anonymous_client.delete("/me").status_code == 401
