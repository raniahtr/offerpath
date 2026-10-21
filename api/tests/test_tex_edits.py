import pytest

from app.schemas.tailoring import EditOp
from app.services.tex_edits import TexEditError, apply_edits, parse_tex
from tests.fake_templates import JAKE_STYLE, MODERNCV, PLAIN_ARTICLE


def _line_id(source: str, fragment: str) -> str:
    """Id of the first body line containing `fragment` (ids are stable: L1 = first body line)."""
    return next(line_id for line_id, text in parse_tex(source).lines() if fragment in text)


def op(kind: str, line: str, text: str | None = None, after: str | None = None) -> EditOp:
    return EditOp(op=kind, line=line, text=text, after=after, sources=["x"], reason="test")


@pytest.mark.parametrize("source", [JAKE_STYLE, MODERNCV, PLAIN_ARTICLE])
def test_no_edits_gives_back_the_exact_file(source: str) -> None:
    assert apply_edits(source, []) == source


@pytest.mark.parametrize("source", [JAKE_STYLE, MODERNCV, PLAIN_ARTICLE])
def test_preamble_and_untouched_lines_are_byte_identical(source: str) -> None:
    doc = parse_tex(source)
    first_id, first_text = next((i, t) for i, t in doc.lines() if t.strip())
    result = apply_edits(source, [op("replace", first_id, text=first_text + " ")])

    assert result.startswith(doc.preamble)
    assert result.endswith(doc.postamble)
    assert result.count("\n") == source.count("\n")


def test_replace_a_bullet_keeping_the_template_macro() -> None:
    line = _line_id(JAKE_STYLE, "FastAPI service")
    new = r"    \resumeItem{Deployed a \textbf{FastAPI} service with Docker}"

    result = apply_edits(JAKE_STYLE, [op("replace", line, text=new)])

    assert new in result
    assert "Shipped a FastAPI service" not in result


def test_insert_delete_and_move() -> None:
    pipeline = _line_id(PLAIN_ARTICLE, "data pipeline")
    tests = _line_id(PLAIN_ARTICLE, "unit tests")
    edits = [
        op("move", tests, after=_line_id(PLAIN_ARTICLE, r"\begin{itemize}")),  # tests first
        op("insert_after", pipeline, text=r"  \item Reviewed pull requests"),
    ]

    result = apply_edits(PLAIN_ARTICLE, edits)
    body = result[result.index(r"\begin{itemize}") : result.index(r"\end{itemize}")]

    assert body.index("unit tests") < body.index("data pipeline") < body.index("Reviewed")


def test_insert_at_top_of_body_with_l0() -> None:
    result = apply_edits(MODERNCV, [op("insert_after", "L0", text=r"\cvitem{Note}{Hello}")])

    assert result.index(r"\cvitem{Note}{Hello}") < result.index(r"\makecvtitle")


def test_delete_a_bullet() -> None:
    line = _line_id(MODERNCV, r"\cvitem{Skills}")

    assert r"\cvitem{Skills}" not in apply_edits(MODERNCV, [op("delete", line)])


def test_comments_and_escapes_on_untouched_lines_survive() -> None:
    other = _line_id(PLAIN_ARTICLE, "unit tests")
    result = apply_edits(PLAIN_ARTICLE, [op("replace", other, text=r"  \item Wrote tests")])

    assert "% keep: real comment" in result


def _rejected(source: str, edits: list[EditOp]) -> list[str]:
    with pytest.raises(TexEditError) as error:
        apply_edits(source, edits)
    return error.value.problems


def test_rejects_unknown_line_and_double_edits() -> None:
    line = _line_id(MODERNCV, r"\cvitem{Skills}")
    problems = _rejected(
        MODERNCV,
        [op("replace", "L999", text="x"), op("delete", line), op("replace", line, text="y")],
    )

    assert any("L999" in p and "unknown" in p for p in problems)
    assert any(line in p and "more than once" in p for p in problems)


def test_rejects_unbalanced_braces() -> None:
    line = _line_id(JAKE_STYLE, "FastAPI service")
    problems = _rejected(JAKE_STYLE, [op("replace", line, text=r"\resumeItem{Broken")])

    assert any("braces" in p for p in problems)


def test_escaped_braces_dont_count() -> None:
    line = _line_id(JAKE_STYLE, "FastAPI service")
    apply_edits(JAKE_STYLE, [op("replace", line, text=r"\resumeItem{Set \{a\} 100\%}")])


@pytest.mark.parametrize(
    "text",
    [
        r"\resumeItem{\input{/etc/passwd}}",
        r"\resumeItem{\immediate\write18{rm -rf ~}}",
        r"\cvitem{Links}{\href{https://x.example}{link}}",  # \href isn't used in this body
        r"\resumeItem{\newcommand{\x}{y}}",
    ],
)
def test_rejects_new_or_dangerous_commands(text: str) -> None:
    line = _line_id(MODERNCV, r"\cvitem{Skills}")  # moderncv body never uses \href or \resumeItem

    assert any("command" in p for p in _rejected(MODERNCV, [op("replace", line, text=text)]))


def test_allows_commands_the_body_already_uses() -> None:
    line = _line_id(JAKE_STYLE, "FastAPI service")
    apply_edits(JAKE_STYLE, [op("replace", line, text=r"\resumeItem{\href{https://x.example}{x}}")])


def test_dangerous_commands_are_rejected_even_if_the_body_uses_them() -> None:
    source = PLAIN_ARTICLE.replace(r"\section*{Ada Example}", r"\input{header}")
    line = _line_id(source, "unit tests")

    problems = _rejected(source, [op("replace", line, text=r"  \item \input{other}")])

    assert any("input" in p for p in problems)


def test_rejects_breaking_environments() -> None:
    begin = _line_id(PLAIN_ARTICLE, r"\begin{itemize}")
    end = _line_id(PLAIN_ARTICLE, r"\end{itemize}")
    bullet = _line_id(PLAIN_ARTICLE, "unit tests")

    problems = _rejected(
        PLAIN_ARTICLE,
        [
            op("delete", begin),
            op("move", end, after="L0"),
            op("insert_after", bullet, text=r"\begin{itemize}"),
        ],
    )

    assert len(problems) == 3
    assert all("environment" in p for p in problems)


def test_rejects_multiline_text_and_bad_anchors() -> None:
    bullet = _line_id(PLAIN_ARTICLE, "unit tests")
    pipeline = _line_id(PLAIN_ARTICLE, "data pipeline")

    problems = _rejected(
        PLAIN_ARTICLE,
        [
            op("insert_after", bullet, text="  \\item a\n  \\item b"),
            op("delete", pipeline),
            op("insert_after", pipeline, text=r"  \item c"),  # anchored on a deleted line
            op("move", bullet, after=bullet),
        ],
    )

    assert any("one line" in p for p in problems)
    assert any("deleted" in p for p in problems)
    assert any("itself" in p for p in problems)


def test_rejects_move_cycles() -> None:
    a = _line_id(PLAIN_ARTICLE, "data pipeline")
    b = _line_id(PLAIN_ARTICLE, "unit tests")

    problems = _rejected(PLAIN_ARTICLE, [op("move", a, after=b), op("move", b, after=a)])

    assert any("cycle" in p for p in problems)


def test_problems_never_contain_cv_text() -> None:
    line = _line_id(JAKE_STYLE, "FastAPI service")
    problems = _rejected(JAKE_STYLE, [op("replace", line, text=r"\resumeItem{Secret{")])

    assert not any("Secret" in p or "FastAPI" in p for p in problems)


def test_op_fields_must_match_the_kind() -> None:
    with pytest.raises(ValueError):
        op("replace", "L1")  # replace needs text
    with pytest.raises(ValueError):
        op("move", "L1")  # move needs `after`
    with pytest.raises(ValueError):
        op("delete", "L1", text="x")


def test_not_a_full_document_is_rejected() -> None:
    with pytest.raises(TexEditError):
        parse_tex(r"\textbf{just a fragment}")


def test_document_markers_inside_comments_are_ignored() -> None:
    source = "% \\begin{document} in a comment\n" + PLAIN_ARTICLE
    assert parse_tex(source).preamble.endswith("\\begin{document}\n")
    assert apply_edits(source, []) == source
