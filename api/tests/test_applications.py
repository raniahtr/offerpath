from typing import Any

from fastapi.testclient import TestClient


def _create(client: TestClient, **overrides: Any) -> dict[str, Any]:
    payload = {"company": "Acme Robotics", "role": "ML Intern", **overrides}
    response = client.post("/applications", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def test_create_application_returns_defaults(client: TestClient) -> None:
    body = _create(client, deadline="2026-12-01")

    assert body["id"] > 0
    assert body["company"] == "Acme Robotics"
    assert body["status"] == "saved"
    assert body["deadline"] == "2026-12-01"
    assert body["notes"] is None
    assert "created_at" in body and "updated_at" in body


def test_create_application_requires_company(client: TestClient) -> None:
    response = client.post("/applications", json={"role": "ML Intern"})

    assert response.status_code == 422


def test_create_application_rejects_blank_company(client: TestClient) -> None:
    response = client.post("/applications", json={"company": "   ", "role": "ML Intern"})

    assert response.status_code == 422


def test_create_application_rejects_unknown_status(client: TestClient) -> None:
    response = client.post(
        "/applications", json={"company": "Acme", "role": "Intern", "status": "ghosted"}
    )

    assert response.status_code == 422


def test_list_applications_newest_first(client: TestClient) -> None:
    first = _create(client, company="First")
    second = _create(client, company="Second")

    response = client.get("/applications")

    assert response.status_code == 200
    assert [a["id"] for a in response.json()] == [second["id"], first["id"]]


def test_list_applications_filters_by_status(client: TestClient) -> None:
    _create(client, company="Saved Co")
    applied = _create(client, company="Applied Co", status="applied")

    response = client.get("/applications", params={"status": "applied"})

    assert response.status_code == 200
    assert [a["id"] for a in response.json()] == [applied["id"]]


def test_list_applications_rejects_unknown_status_filter(client: TestClient) -> None:
    response = client.get("/applications", params={"status": "ghosted"})

    assert response.status_code == 422


def test_get_application(client: TestClient) -> None:
    created = _create(client)

    response = client.get(f"/applications/{created['id']}")

    assert response.status_code == 200
    assert response.json() == created


def test_get_unknown_application_returns_404(client: TestClient) -> None:
    response = client.get("/applications/999999")

    assert response.status_code == 404


def test_update_application_changes_only_sent_fields(client: TestClient) -> None:
    created = _create(client, notes="referral from a friend")

    response = client.patch(f"/applications/{created['id']}", json={"status": "interview"})

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "interview"
    assert body["notes"] == "referral from a friend"
    assert body["company"] == created["company"]


def test_update_application_can_clear_optional_field(client: TestClient) -> None:
    created = _create(client, notes="to be removed")

    response = client.patch(f"/applications/{created['id']}", json={"notes": None})

    assert response.status_code == 200
    assert response.json()["notes"] is None


def test_update_application_rejects_null_required_field(client: TestClient) -> None:
    created = _create(client)

    response = client.patch(f"/applications/{created['id']}", json={"company": None})

    assert response.status_code == 422


def test_update_unknown_application_returns_404(client: TestClient) -> None:
    response = client.patch("/applications/999999", json={"status": "applied"})

    assert response.status_code == 404


def test_delete_application(client: TestClient) -> None:
    created = _create(client)

    response = client.delete(f"/applications/{created['id']}")

    assert response.status_code == 204
    assert client.get(f"/applications/{created['id']}").status_code == 404


def test_delete_unknown_application_returns_404(client: TestClient) -> None:
    response = client.delete("/applications/999999")

    assert response.status_code == 404
