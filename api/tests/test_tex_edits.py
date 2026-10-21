import pytest

from app.schemas.tailoring import EditOp
from app.services.tex_edits import TexEditError, apply_edits, parse_tex
from tests.fake_templates import ENTRIES, JAKE_STYLE, MODERNCV, PLAIN_ARTICLE


def _line_id(source: str, fragment: str, offset: int = 0) -> str:
    """Id of the first body line containing `fragment` (ids are stable: L1 = first body line),
    or of the line `offset` lines below it."""
    line_id = next(line_id for line_id, text in parse_tex(source).lines() if fragment in text)
    return f"L{int(line_id[1:]) + offset}"


def op(
    kind: str,
    line: str,
    text: str | None = None,
    after: str | None = None,
    to: str | None = None,
) -> EditOp:
    return EditOp(op=kind, line=line, to=to, text=text, after=after, sources=["x"], reason="t")


@pytest.mark.parametrize("source", [JAKE_STYLE, MODERNCV, PLAIN_ARTICLE, ENTRIES])
def test_no_edits_gives_back_the_exact_file(source: str) -> None:
    assert apply_edits(source, []) == source


@pytest.mark.parametrize("source", [JAKE_STYLE, MODERNCV, PLAIN_ARTICLE, ENTRIES])
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


def test_rejects_multiline_replace_and_bad_anchors() -> None:
    bullet = _line_id(PLAIN_ARTICLE, "unit tests")
    pipeline = _line_id(PLAIN_ARTICLE, "data pipeline")

    problems = _rejected(
        PLAIN_ARTICLE,
        [
            op("replace", bullet, text="  \\item a\n  \\item b"),
            op("delete", pipeline),
            op("insert_after", pipeline, text=r"  \item c"),  # anchored on a deleted line
            op("move", bullet, after=bullet),
        ],
    )

    assert any("one line" in p for p in problems)
    assert any("deleted" in p for p in problems)
    assert any("itself" in p for p in problems)


# --- Blocks: whole entries and sections ---


def test_move_a_whole_entry_to_the_top_of_its_section() -> None:
    first = _line_id(ENTRIES, r"\entry{Campus app}")
    last = _line_id(ENTRIES, "React Native app", offset=1)  # its \end{itemize}

    result = apply_edits(
        ENTRIES, [op("move", first, to=last, after=_line_id(ENTRIES, r"\section{Projects}"))]
    )
    projects = result[result.index(r"\section{Projects}") :]

    assert projects.index("Campus app") < projects.index("Spike sorter")
    assert projects.count(r"\begin{itemize}") == projects.count(r"\end{itemize}") == 2


def test_move_a_whole_section_with_its_content() -> None:
    first = _line_id(ENTRIES, r"\section{Projects}")
    last = _line_id(ENTRIES, "React Native app", offset=1)

    result = apply_edits(ENTRIES, [op("move", first, to=last, after="L0")])

    assert result.index("Spike sorter") < result.index(r"\section{Experience}")
    assert result.index("Campus app") < result.index(r"\section{Experience}")


def test_rephrasing_a_line_inside_a_moved_block_is_fine() -> None:
    first = _line_id(ENTRIES, r"\entry{Campus app}")
    bullet = _line_id(ENTRIES, "React Native app")
    edits = [
        op("move", first, to=f"L{int(bullet[1:]) + 1}", after=_line_id(ENTRIES, "Projects}")),
        op("replace", bullet, text=r"  \item Built a \textbf{React Native} app"),
    ]

    result = apply_edits(ENTRIES, edits)

    assert result.index(r"\textbf{React Native}") < result.index("Spike sorter")


def test_delete_a_whole_entry() -> None:
    first = _line_id(ENTRIES, r"\entry{Spike sorter}")
    result = apply_edits(ENTRIES, [op("delete", first, to=_line_id(ENTRIES, "scikit", offset=1))])

    assert "Spike sorter" not in result and "scikit" not in result
    assert result.count(r"\begin{itemize}") == result.count(r"\end{itemize}") == 2


def test_insert_a_new_entry_as_one_balanced_block() -> None:
    block = "\n".join(
        [
            r"\entry{Offerpath}{2026}",
            r"\begin{itemize}",
            r"  \item Built a FastAPI and Next.js app",
            r"\end{itemize}",
        ]
    )
    result = apply_edits(ENTRIES, [op("insert_after", _line_id(ENTRIES, "Projects}"), text=block)])

    assert result.index("Offerpath") < result.index("Spike sorter")


def test_a_bullet_cant_leave_its_list() -> None:
    bullet = _line_id(ENTRIES, "Shipped a FastAPI")
    header = _line_id(ENTRIES, r"\entry{ML Intern")
    other_list = _line_id(ENTRIES, "scikit")

    problems = _rejected(ENTRIES, [op("move", bullet, after=header)])
    assert any("same list" in p for p in problems)
    # Into another entry's list would credit the work to the wrong entry: also rejected.
    problems = _rejected(ENTRIES, [op("move", bullet, after=other_list)])
    assert any("same list" in p for p in problems)


def test_a_section_heading_cant_move_or_go_without_its_content() -> None:
    heading = _line_id(ENTRIES, r"\section{Projects}")
    half = _line_id(ENTRIES, "scikit", offset=1)  # ends after the first project only

    problems = _rejected(
        ENTRIES,
        [op("move", heading, after="L0")],
    )
    assert any("whole section" in p for p in problems)
    assert any("whole section" in p for p in _rejected(ENTRIES, [op("delete", heading)]))
    problems = _rejected(ENTRIES, [op("move", heading, to=half, after="L0")])
    assert any("whole section" in p for p in problems)


def test_bare_items_can_only_be_inserted_into_a_list() -> None:
    header = _line_id(ENTRIES, r"\entry{ML Intern")

    problems = _rejected(ENTRIES, [op("insert_after", header, text=r"\item Stray bullet")])

    assert any("inside a list" in p for p in problems)


def test_ranges_must_be_balanced_and_well_formed() -> None:
    header = _line_id(ENTRIES, r"\entry{Spike sorter}")
    begin = _line_id(ENTRIES, "scikit", offset=-1)

    problems = _rejected(ENTRIES, [op("move", header, to=begin, after="L0")])  # cuts the list
    assert any("environment" in p for p in problems)
    problems = _rejected(ENTRIES, [op("delete", begin, to=header)])
    assert any("ends before" in p for p in problems)


def test_overlapping_blocks_are_rejected() -> None:
    first = _line_id(ENTRIES, r"\entry{Spike sorter}")
    last = _line_id(ENTRIES, "scikit", offset=1)
    bullet = _line_id(ENTRIES, "scikit")

    problems = _rejected(ENTRIES, [op("delete", first, to=last), op("move", bullet, after=first)])

    assert any("more than once" in p for p in problems)


def test_inserted_blocks_cant_bring_new_environments() -> None:
    block = "\\begin{verbatim}\nx\n\\end{verbatim}"
    problems = _rejected(ENTRIES, [op("insert_after", "L0", text=block)])

    assert any("environment" in p and "verbatim" in p for p in problems)


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
    with pytest.raises(ValueError):
        op("replace", "L1", text="x", to="L3")  # ranges are for move/delete only


def test_not_a_full_document_is_rejected() -> None:
    with pytest.raises(TexEditError):
        parse_tex(r"\textbf{just a fragment}")


def test_document_markers_inside_comments_are_ignored() -> None:
    source = "% \\begin{document} in a comment\n" + PLAIN_ARTICLE
    assert parse_tex(source).preamble.endswith("\\begin{document}\n")
    assert apply_edits(source, []) == source
