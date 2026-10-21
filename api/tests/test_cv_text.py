from app.services.cv_text import cv_prompt_text, latex_to_text
from tests.fake_data import FAKE_CV_LATEX


def test_latex_becomes_readable_text() -> None:
    text = latex_to_text(FAKE_CV_LATEX)

    assert "Ada Example" in text
    assert "ada@example.com (mailto:ada@example.com)" in text
    assert "Acme Labs | ML Intern | 2025 – 2026" in text  # custom macro arguments kept
    assert "- Trained PyTorch models on 10% of R&D data" in text  # escapes restored
    assert "- Shipped a FastAPI service with Docker" in text


def test_preamble_comments_and_markup_are_dropped() -> None:
    text = latex_to_text(FAKE_CV_LATEX)

    assert "usepackage" not in text and "newcommand" not in text  # preamble
    assert "private note" not in text  # comments never reach the LLM
    assert "\\" not in text and "{" not in text and "}" not in text


def test_cleanup_shrinks_the_prompt() -> None:
    assert len(latex_to_text(FAKE_CV_LATEX)) < len(FAKE_CV_LATEX) * 0.6


def test_latex_without_document_environment_still_works() -> None:
    assert latex_to_text(r"\textbf{Python} and \emph{SQL}") == "Python and SQL"


def test_plain_text_and_pdf_text_only_get_whitespace_normalised() -> None:
    assert cv_prompt_text("Ada   Example\n\n\n\nPython {x}", "text") == "Ada Example\n\nPython {x}"
