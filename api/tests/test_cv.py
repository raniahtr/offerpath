from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient

from tests.fake_data import FAKE_CV_LATEX, make_pdf

Headers = Callable[[str], dict[str, str]]
PDF = {"Content-Type": "application/pdf"}


def test_save_then_read_cv(client: TestClient) -> None:
    assert client.get("/cv").status_code == 404

    saved = client.put("/cv", json={"content": FAKE_CV_LATEX, "format": "latex"})
    assert saved.status_code == 200
    assert client.get("/cv").json()["content"] == FAKE_CV_LATEX.strip()


def test_saving_again_replaces_the_cv(client: TestClient) -> None:
    client.put("/cv", json={"content": "old", "format": "text"})
    client.put("/cv", json={"content": "new", "format": "text"})

    assert client.get("/cv").json()["content"] == "new"


@pytest.mark.parametrize(
    "body",
    [
        {"content": "   ", "format": "text"},
        {"content": "x" * 50_001, "format": "text"},
        {"content": "ok", "format": "docx"},
    ],
)
def test_invalid_cv_is_rejected(client: TestClient, body: dict[str, str]) -> None:
    assert client.put("/cv", json=body).status_code == 422


def test_cv_is_private(client: TestClient, auth_headers: Headers) -> None:
    client.put("/cv", json={"content": FAKE_CV_LATEX, "format": "latex"})

    assert client.get("/cv", headers=auth_headers("user-b")).status_code == 404
    client.delete("/cv", headers=auth_headers("user-b"))
    assert client.get("/cv").status_code == 200  # B's delete didn't touch A's CV


def test_delete_cv(client: TestClient) -> None:
    client.put("/cv", json={"content": "x", "format": "text"})

    assert client.delete("/cv").status_code == 204
    assert client.get("/cv").status_code == 404


def test_requires_sign_in(anonymous_client: TestClient) -> None:
    assert anonymous_client.get("/cv").status_code == 401


def test_pdf_text_is_extracted_but_not_saved(client: TestClient) -> None:
    response = client.post("/cv/pdf", content=make_pdf("Ada Example Python"), headers=PDF)

    assert response.status_code == 200
    assert response.json() == {"text": "Ada Example Python", "pages": 1}
    assert client.get("/cv").status_code == 404  # the user reviews it, then saves via PUT


def test_pdf_requires_pdf_content_type(client: TestClient) -> None:
    response = client.post("/cv/pdf", content=make_pdf("x"), headers={"Content-Type": "text/plain"})
    assert response.status_code == 415


def test_pdf_over_2_mb_is_refused(client: TestClient) -> None:
    response = client.post("/cv/pdf", content=b"%PDF-" + b"0" * (2 * 1024 * 1024), headers=PDF)
    assert response.status_code == 413


@pytest.mark.parametrize(
    ("content", "message"),
    [
        (b"hello, not a pdf", "Not a PDF file"),
        (b"%PDF-1.4 broken", "could not be read"),
        (make_pdf(""), "No text found"),
    ],
)
def test_unusable_pdf_gets_a_clear_message(
    client: TestClient, content: bytes, message: str
) -> None:
    response = client.post("/cv/pdf", content=content, headers=PDF)

    assert response.status_code == 422
    assert message in response.json()["detail"]
