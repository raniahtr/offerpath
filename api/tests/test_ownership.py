"""Data isolation: user B must never read, change or delete user A's applications.

Someone else's application must look exactly like a missing one (404), so ids can't be
probed to learn what exists.
"""

from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient

Headers = Callable[[str], dict[str, str]]


@pytest.fixture
def alices_application(client: TestClient) -> int:
    response = client.post("/applications", json={"company": "Acme", "role": "ML Intern"})
    assert response.status_code == 201
    return response.json()["id"]


def test_list_only_shows_own_applications(
    client: TestClient, auth_headers: Headers, alices_application: int
) -> None:
    bob = auth_headers("user-b")
    client.post("/applications", json={"company": "Globex", "role": "Intern"}, headers=bob)

    alice_sees = [a["company"] for a in client.get("/applications").json()]
    bob_sees = [a["company"] for a in client.get("/applications", headers=bob).json()]

    assert alice_sees == ["Acme"]
    assert bob_sees == ["Globex"]


def test_status_filter_is_also_scoped(
    client: TestClient, auth_headers: Headers, alices_application: int
) -> None:
    response = client.get("/applications", params={"status": "saved"}, headers=auth_headers("b"))

    assert response.json() == []


@pytest.mark.parametrize(
    ("method", "body"),
    [("get", None), ("patch", {"status": "offer"}), ("delete", None)],
)
def test_other_users_application_looks_missing(
    client: TestClient,
    auth_headers: Headers,
    alices_application: int,
    method: str,
    body: dict[str, str] | None,
) -> None:
    url = f"/applications/{alices_application}"
    kwargs = {"json": body} if body else {}

    as_bob = client.request(method.upper(), url, headers=auth_headers("user-b"), **kwargs)
    truly_missing = client.request(method.upper(), "/applications/999999", **kwargs)

    assert as_bob.status_code == 404
    assert as_bob.json() == truly_missing.json() == {"detail": "Application not found"}


def test_other_user_cannot_change_or_delete(
    client: TestClient, auth_headers: Headers, alices_application: int
) -> None:
    bob = auth_headers("user-b")
    url = f"/applications/{alices_application}"
    client.patch(url, json={"status": "rejected"}, headers=bob)
    client.delete(url, headers=bob)

    unchanged = client.get(url)
    assert unchanged.status_code == 200
    assert unchanged.json()["status"] == "saved"


def test_owner_comes_from_token_not_from_body(client: TestClient, auth_headers: Headers) -> None:
    # A client trying to create an application on someone else's behalf.
    response = client.post(
        "/applications", json={"company": "Sneaky", "role": "Intern", "user_id": "user-b"}
    )
    assert response.status_code == 201
    assert "user_id" not in response.json()

    assert client.get("/applications", headers=auth_headers("user-b")).json() == []
    assert [a["company"] for a in client.get("/applications").json()] == ["Sneaky"]
