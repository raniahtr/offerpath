from app.schemas.tailoring import EditOp
from app.services.cv_text import latex_to_text
from app.services.grounding import check_grounding
from tests.fake_data import FAKE_CV_LATEX

CV = latex_to_text(FAKE_CV_LATEX)  # what the model sees, so what it quotes
FACT = "Led a team of 3 students on a spike-sorting project in 2025"
ORIGINAL = {"L7": r"  \item Trained \textbf{PyTorch} models on 10\% of R\&D data"}


def edit(text: str | None, sources: list[str], kind: str = "replace", line: str = "L7") -> EditOp:
    return EditOp(op=kind, line=line, to=None, text=text, after=None, sources=sources, reason="r")


def check(*edits: EditOp) -> list[str]:
    return check_grounding(list(edits), sources=[CV, FACT], originals=ORIGINAL)


def test_quotes_from_cv_and_facts_pass() -> None:
    assert (
        check(
            edit(
                r"  \item Trained PyTorch models on 10\% of company data",
                ["Trained PyTorch models"],
            ),
            edit(r"  \item Led a 3-person team", [FACT], kind="insert_after"),
        )
        == []
    )


def test_quote_matching_ignores_case_whitespace_and_latex_markup() -> None:
    quotes = [
        "trained \n " + r"\textbf{pytorch} MODELS on 10\% of R\&D data",  # newline = whitespace
        "shipped a fastapi SERVICE",
    ]
    assert check(edit(r"  \item Trained PyTorch models", quotes)) == []


def test_made_up_quote_fails_with_line_and_index_only() -> None:
    problems = check(edit(r"  \item Built Kubernetes clusters", ["Trained PyTorch", "Kubernetes"]))

    assert problems == ["L7: source 2 is not in your CV or facts"]


def test_new_or_changed_text_needs_a_source() -> None:
    assert check(edit(r"  \item Anything", [])) == ["L7: needs at least one source"]


def test_too_short_quotes_dont_count() -> None:
    assert check(edit(r"  \item Trained", ["a"])) == ["L7: source 1 is too short to check"]


def test_invented_number_fails() -> None:
    problems = check(edit(r"  \item Improved accuracy by 30\%", ["Trained PyTorch models"]))

    assert problems == ["L7: number 30 is not in its sources"]


def test_numbers_may_come_from_the_line_being_replaced() -> None:
    assert check(edit(r"  \item Used 10\% of the data", ["Trained PyTorch models"])) == []


def test_number_match_is_whole_number_not_digit_substring() -> None:
    # "1" appears inside "10" and "2025", but not as a number of its own.
    problems = check(edit(r"  \item 1 model", ["Trained PyTorch models"], kind="insert_after"))

    assert problems == ["after L7: number 1 is not in its sources"]


def test_layout_numbers_are_not_claims() -> None:
    block = "\n".join(
        [r"\begin{itemize}[leftmargin=0.15in, nosep]", r"  \item Trained models", r"\vspace{-2pt}"]
    )
    assert check(edit(block, ["Trained PyTorch models"], kind="insert_after")) == []


def test_delete_and_move_need_no_sources() -> None:
    assert (
        check(
            edit(None, [], kind="delete"),
            EditOp(op="move", line="L7", to=None, text=None, after="L0", sources=[], reason="r"),
        )
        == []
    )


def test_problems_never_contain_cv_text() -> None:
    problems = check(edit(r"  \item Secret 42", ["Secret quote here"]))

    assert problems and not any("Secret" in p for p in problems)
