"""Apply LLM-proposed line edits to a CV's .tex, keeping the template intact.

The LLM never writes the whole file: it sees numbered body lines and returns EditOps. Code
applies them, so the preamble (packages, macros) and every untouched line stay byte-identical,
and each changed line can be checked on its own. Structural rules reject edits that would
break compilation or smuggle in new behaviour. Problem messages name line ids and reasons
only, never CV text, so they are safe to log and to send back to the model.
"""

import re
from collections import Counter, defaultdict
from dataclasses import dataclass

from app.schemas.tailoring import EditOp

TOP = "L0"  # anchor meaning "before the first body line"

# Never allowed in new text, even if the CV itself uses them: file access, shell escape,
# redefinitions. Everything else must already appear in the document body.
_FORBIDDEN = {
    "input", "include", "write", "immediate", "openout", "openin", "read", "special",
    "catcode", "def", "edef", "gdef", "xdef", "let", "csname", "newcommand",
    "renewcommand", "providecommand", "usepackage", "documentclass",
}  # fmt: skip

_BEGIN_DOC = re.compile(r"^[^%\n]*\\begin\{document\}.*\n?", re.MULTILINE)
_END_DOC = re.compile(r"^[^%\n]*\\end\{document\}", re.MULTILINE)
_ESCAPE = re.compile(r"\\[{}\\%&$#_]")  # \{ \} \\ \% ... are text, not structure
_COMMAND = re.compile(r"\\([a-zA-Z@]+)")
_ENVIRONMENT = re.compile(r"\\(begin|end)\{([^}]*)\}")


class TexEditError(ValueError):
    def __init__(self, problems: list[str]) -> None:
        super().__init__("; ".join(problems))
        self.problems = problems


@dataclass(frozen=True)
class TexDocument:
    preamble: str  # up to and including the \begin{document} line
    body: list[str]  # one entry per line, without the newline
    postamble: str  # from the \end{document} line to the end

    def lines(self) -> list[tuple[str, str]]:
        return [(f"L{number}", text) for number, text in enumerate(self.body, start=1)]


def parse_tex(source: str) -> TexDocument:
    begin = _BEGIN_DOC.search(source)
    ends = list(_END_DOC.finditer(source))
    if begin is None or not ends or ends[-1].start() < begin.end():
        raise TexEditError(["not a complete LaTeX document (needs \\begin/\\end{document})"])
    body = source[begin.end() : ends[-1].start()]
    return TexDocument(
        preamble=source[: begin.end()],
        body=body.split("\n")[:-1] if body else [],  # body ends with "\n" before \end{document}
        postamble=source[ends[-1].start() :],
    )


def _code(line: str) -> str:
    """The line without escaped characters and comments: only what affects structure."""
    code = _ESCAPE.sub("", line)
    return code.split("%", 1)[0]


def _brace_depth(line: str) -> int:
    code = _code(line)
    return code.count("{") - code.count("}")


def _environments(line: str) -> Counter[tuple[str, str]]:
    return Counter(_ENVIRONMENT.findall(_code(line)))


def _commands(line: str) -> set[str]:
    return set(_COMMAND.findall(_code(line)))


def _check_text(line_id: str, text: str, original: str | None, allowed: set[str]) -> list[str]:
    """Rules for a replacement (`original` given) or an inserted line (`original` None)."""
    if "\n" in text or "\r" in text:
        return [f"{line_id}: new text must be one line"]
    problems = []
    forbidden = sorted(_commands(text) & _FORBIDDEN)
    unknown = sorted(_commands(text) - allowed - _FORBIDDEN)
    if forbidden:
        problems.append(f"{line_id}: forbidden command(s) {', '.join(forbidden)}")
    if unknown:
        problems.append(f"{line_id}: command(s) not used elsewhere in the CV: {', '.join(unknown)}")
    if _brace_depth(text) != (_brace_depth(original) if original is not None else 0):
        problems.append(f"{line_id}: unbalanced braces")
    if original is not None and _environments(text) != _environments(original):
        problems.append(f"{line_id}: must keep the same environment begin/end as the original")
    if original is None and _environments(text):
        problems.append(f"{line_id}: inserted lines can't open or close an environment")
    return problems


def apply_edits(source: str, edits: list[EditOp]) -> str:
    doc = parse_tex(source)
    text_by_id = dict(doc.lines())
    allowed = set().union(*(_commands(line) for line in doc.body))
    problems: list[str] = []

    def known(line_id: str, *, anchor: bool = False) -> bool:
        if line_id in text_by_id or (anchor and line_id == TOP):
            return True
        problems.append(f"{line_id}: unknown line id")
        return False

    # Lines an op takes over (replace/delete/move): at most one op each.
    targeted = Counter(e.line for e in edits if e.op != "insert_after")
    for line_id, count in targeted.items():
        if count > 1:
            problems.append(f"{line_id}: edited more than once")
    deleted = {e.line for e in edits if e.op == "delete"}

    replacements: dict[str, str] = {}
    attached: defaultdict[str, list[tuple[str, str]]] = defaultdict(list)  # anchor -> items
    moved: set[str] = set()
    for edit in edits:
        if edit.op == "replace" and known(edit.line) and edit.text is not None:
            problems += _check_text(edit.line, edit.text, text_by_id[edit.line], allowed)
            replacements[edit.line] = edit.text
        elif edit.op == "delete" and known(edit.line):
            if _environments(text_by_id[edit.line]):
                problems.append(f"{edit.line}: can't delete a line opening/closing an environment")
        elif edit.op == "insert_after" and known(edit.line, anchor=True) and edit.text is not None:
            if edit.line in deleted:
                problems.append(f"{edit.line}: can't insert after a deleted line")
            problems += _check_text(f"after {edit.line}", edit.text, None, allowed)
            attached[edit.line].append(("new", edit.text))
        elif edit.op == "move" and edit.after is not None:
            if not (known(edit.line) and known(edit.after, anchor=True)):
                continue
            if edit.after == edit.line:
                problems.append(f"{edit.line}: can't move a line after itself")
            elif edit.after in deleted:
                problems.append(f"{edit.line}: can't move after a deleted line")
            elif _environments(text_by_id[edit.line]):
                problems.append(f"{edit.line}: can't move a line that opens/closes an environment")
            else:
                attached[edit.after].append(("line", edit.line))
                moved.add(edit.line)

    out: list[str] = []
    emitted: set[str] = set()

    def emit_attached(anchor: str) -> None:
        for kind, value in attached.get(anchor, []):
            if kind == "new":
                out.append(value)
            elif value not in emitted:
                emit(value)

    def emit(line_id: str) -> None:
        emitted.add(line_id)
        if line_id not in deleted:
            out.append(replacements.get(line_id, text_by_id[line_id]))
        emit_attached(line_id)

    emit_attached(TOP)
    for line_id in text_by_id:
        if line_id not in moved:
            emit(line_id)
    # A moved line is only reachable through its anchor: unreached means anchors form a loop.
    stranded = sorted(moved - emitted, key=lambda i: int(i[1:]))
    if stranded:
        problems.append(f"{', '.join(stranded)}: moves form a cycle")

    if problems:
        raise TexEditError(problems)
    body = "".join(f"{line}\n" for line in out)
    return doc.preamble + body + doc.postamble
