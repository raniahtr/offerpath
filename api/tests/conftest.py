import os
import time
from collections.abc import Callable, Iterator
from pathlib import Path
from typing import Any

import jwt
import pytest
from alembic.config import Config
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session

from alembic import command

# Tests use their own database. Default = the compose db reached from the host (port 5432);
# compose and CI override it via TEST_DATABASE_URL.
TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+psycopg://offerpath:offerpath@localhost:5432/offerpath_test"
)
# The app reads its settings at import time; point the db at the test db so nothing touches
# dev data, and the auth settings at a fake identity provider that only exists in tests.
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
TEST_ISSUER = "https://auth.test"
TEST_AUDIENCE = "https://auth.test"
os.environ["AUTH_JWKS_URL"] = "https://auth.test/.well-known/jwks.json"
os.environ["AUTH_ISSUER"] = TEST_ISSUER
os.environ["AUTH_AUDIENCE"] = TEST_AUDIENCE

import app.auth  # noqa: E402
from app.db import get_db  # noqa: E402
from app.main import app as fastapi_app  # noqa: E402

# The fake provider's signing key (Ed25519 = EdDSA, what Neon Auth uses). Generated per test
# run, never stored: tests sign tokens with it, the app verifies them with the public half.
_SIGNING_KEY = Ed25519PrivateKey.generate()
_KEY_ID = "test-key-1"


class _FakeJwksClient:
    """Stands in for PyJWKClient: serves our public key instead of fetching it over HTTP."""

    def __init__(self) -> None:
        jwk = jwt.algorithms.OKPAlgorithm.to_jwk(_SIGNING_KEY.public_key(), as_dict=True)
        self._key = jwt.PyJWK({**jwk, "kid": _KEY_ID, "alg": "EdDSA"})

    def get_signing_key_from_jwt(self, token: str) -> jwt.PyJWK:
        if jwt.get_unverified_header(token).get("kid") != _KEY_ID:
            raise jwt.PyJWKClientError("Unable to find a signing key that matches")
        return self._key


@pytest.fixture(autouse=True)
def fake_identity_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    # Only the key download is faked; signature, expiry, issuer and audience checks are real.
    monkeypatch.setattr(app.auth, "get_jwks_client", _FakeJwksClient)


TokenFactory = Callable[..., str]


@pytest.fixture
def make_token() -> TokenFactory:
    """make_token("user-a") -> a valid token; keyword overrides build invalid ones."""

    def _make(
        sub: str = "user-a",
        *,
        key: Any = _SIGNING_KEY,
        kid: str = _KEY_ID,
        expires_in: int = 900,
        **claims: Any,
    ) -> str:
        now = int(time.time())
        payload = {
            "sub": sub,
            "iss": TEST_ISSUER,
            "aud": TEST_AUDIENCE,
            "iat": now,
            "exp": now + expires_in,
            **claims,
        }
        return jwt.encode(payload, key, algorithm="EdDSA", headers={"kid": kid})

    return _make


@pytest.fixture
def auth_headers(make_token: TokenFactory) -> Callable[[str], dict[str, str]]:
    """auth_headers("user-b") -> headers that sign the request in as that user."""
    return lambda sub: {"Authorization": f"Bearer {make_token(sub)}"}


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
def anonymous_client(db_session: Session) -> Iterator[TestClient]:
    """A client that is not signed in."""
    fastapi_app.dependency_overrides[get_db] = lambda: db_session
    with TestClient(fastapi_app) as test_client:
        yield test_client
    fastapi_app.dependency_overrides.clear()


@pytest.fixture
def client(
    anonymous_client: TestClient, auth_headers: Callable[[str], dict[str, str]]
) -> TestClient:
    """A client signed in as "user-a"; pass headers=auth_headers("user-b") to act as another."""
    anonymous_client.headers.update(auth_headers("user-a"))
    return anonymous_client
