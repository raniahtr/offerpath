from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient

from tests.fake_data import FAKE_POSTING

Headers = Callable[[str], dict[str, str]]


def test_create_list_get_delete(client: TestClient) -> None:
    created = client.post("/postings", json=FAKE_POSTING)
    assert created.status_code == 201
    posting_id = created.json()["id"]

    assert [p["id"] for p in client.get("/postings").json()] == [posting_id]
    assert client.get(f"/postings/{posting_id}").json()["company"] == "Globex"
    assert client.delete(f"/postings/{posting_id}").status_code == 204
    assert client.get(f"/postings/{posting_id}").status_code == 404


@pytest.mark.parametrize(
    "override",
    [{"title": ""}, {"company": "  "}, {"description": "x" * 20_001}, {"url": "x" * 2001}],
)
def test_invalid_posting_is_rejected(client: TestClient, override: dict[str, str]) -> None:
    assert client.post("/postings", json={**FAKE_POSTING, **override}).status_code == 422


def test_postings_are_private(client: TestClient, auth_headers: Headers) -> None:
    posting_id = client.post("/postings", json=FAKE_POSTING).json()["id"]
    bob = auth_headers("user-b")

    assert client.get("/postings", headers=bob).json() == []
    assert client.get(f"/postings/{posting_id}", headers=bob).status_code == 404
    assert client.delete(f"/postings/{posting_id}", headers=bob).status_code == 404
    assert client.get(f"/postings/{posting_id}").status_code == 200
