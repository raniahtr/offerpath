"""Sign-in checks: every way a token can be wrong must end in 401, never in data."""

import base64
import json
import logging
from collections.abc import Callable

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from fastapi.testclient import TestClient

import app.auth
from tests.conftest import TokenFactory


def _get_with(client: TestClient, token: str) -> int:
    return client.get("/applications", headers={"Authorization": f"Bearer {token}"}).status_code


def test_valid_token_is_accepted(anonymous_client: TestClient, make_token: TokenFactory) -> None:
    assert _get_with(anonymous_client, make_token("user-a")) == 200


def test_missing_token_is_rejected(anonymous_client: TestClient) -> None:
    response = anonymous_client.get("/applications")

    assert response.status_code == 401
    assert response.headers["WWW-Authenticate"] == "Bearer"
    assert response.json() == {"detail": "Not signed in"}


def test_health_stays_public(anonymous_client: TestClient) -> None:
    assert anonymous_client.get("/health").status_code == 200


@pytest.mark.parametrize(
    ("description", "build"),
    [
        ("expired", lambda make: make(expires_in=-60)),
        ("signed by another key", lambda make: make(key=Ed25519PrivateKey.generate())),
        ("unknown key id", lambda make: make(kid="someone-elses-key")),
        ("wrong issuer", lambda make: make(iss="https://evil.test")),
        ("wrong audience", lambda make: make(aud="https://other-app.test")),
        ("empty subject", lambda make: make(sub="")),
    ],
)
def test_invalid_tokens_are_rejected(
    anonymous_client: TestClient,
    make_token: TokenFactory,
    description: str,
    build: Callable[[TokenFactory], str],
) -> None:
    assert _get_with(anonymous_client, build(make_token)) == 401, description


def test_garbage_token_is_rejected(anonymous_client: TestClient) -> None:
    assert _get_with(anonymous_client, "not-a-jwt") == 401


def test_unsigned_token_is_rejected(anonymous_client: TestClient, make_token: TokenFactory) -> None:
    # Classic attack: take a valid token, switch its header to alg "none", drop the signature.
    _, payload, _ = make_token("user-a").split(".")
    header = base64.urlsafe_b64encode(
        json.dumps({"alg": "none", "kid": "test-key-1"}).encode()
    ).rstrip(b"=")
    forged = f"{header.decode()}.{payload}."

    assert _get_with(anonymous_client, forged) == 401


def test_identity_provider_outage_is_503_not_401(
    anonymous_client: TestClient, make_token: TokenFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    class _Unreachable:
        def get_signing_key_from_jwt(self, token: str) -> jwt.PyJWK:
            raise jwt.PyJWKClientConnectionError("connection refused")

    monkeypatch.setattr(app.auth, "get_jwks_client", _Unreachable)

    assert _get_with(anonymous_client, make_token("user-a")) == 503


def test_rejection_reason_is_logged_but_not_returned(
    anonymous_client: TestClient, make_token: TokenFactory, caplog: pytest.LogCaptureFixture
) -> None:
    token = make_token("user-a", iss="https://evil.example")

    with caplog.at_level(logging.WARNING, logger="app.auth"):
        response = anonymous_client.get(
            "/applications", headers={"Authorization": f"Bearer {token}"}
        )

    assert response.json() == {"detail": "Invalid token"}
    assert "Invalid issuer" in caplog.text
    assert token not in caplog.text
