import os
from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session

from alembic import command

# Tests use their own database. Default = the compose db reached from the host (port 5432);
# compose and CI override it via TEST_DATABASE_URL.
TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+psycopg://offerpath:offerpath@localhost:5432/offerpath_test"
)
# The app reads DATABASE_URL at import time; point it at the test db so nothing touches dev data.
os.environ["DATABASE_URL"] = TEST_DATABASE_URL

from app.db import get_db  # noqa: E402
from app.main import app  # noqa: E402

ALEMBIC_INI = Path(__file__).resolve().parents[1] / "alembic.ini"


@pytest.fixture(scope="session")
def engine() -> Iterator[Engine]:
    """Once per test run: reset the test schema by running all migrations down and up."""
    engine = create_engine(TEST_DATABASE_URL)
    config = Config(str(ALEMBIC_INI))
    with engine.begin() as connection:
        config.attributes["connection"] = connection
        command.downgrade(config, "base")
        command.upgrade(config, "head")
    yield engine
    engine.dispose()


@pytest.fixture
def db_session(engine: Engine) -> Iterator[Session]:
    """Per test: everything runs inside one transaction that is rolled back at the end.

    `create_savepoint` turns the app's `commit()` calls into savepoints, so they never
    really commit and each test starts with empty tables.
    """
    with engine.connect() as connection:
        transaction = connection.begin()
        session = Session(
            bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False
        )
        try:
            yield session
        finally:
            session.close()
            transaction.rollback()


@pytest.fixture
def client(db_session: Session) -> Iterator[TestClient]:
    app.dependency_overrides[get_db] = lambda: db_session
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
