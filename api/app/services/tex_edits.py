"""Apply LLM-proposed line edits to a CV's .tex, keeping the template intact.

The LLM never writes the whole file: it sees numbered body lines and returns EditOps. Code
applies them, so the preamble (packages, macros) and every untouched line stay byte-identical,
and each changed line can be checked on its own. Structural rules reject edits that would
break compilation, credit work to the wrong entry, or smuggle in new behaviour:

- a replaced line keeps its environment begin/end and brace balance;
- deleted, moved and inserted blocks are balanced on their own (every \\begin closed inside);
- a moved line or block lands at the same nesting level it came from (a bullet stays in its
  own list), and a section heading only moves or goes away with its whole section.

Problem messages name line ids and reasons only, never CV text, so they are safe to log and
to send back to the model.
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
_LISTS = {"itemize", "enumerate", "description"}

_BEGIN_DOC = re.compile(r"^[^%\n]*\\begin\{document\}.*\n?", re.MULTILINE)
_END_DOC = re.compile(r"^[^%\n]*\\end\{document\}", re.MULTILINE)
_ESCAPE = re.compile(r"\\[{}\\%&$#_]")  # \{ \} \\ \% ... are text, not structure
_COMMAND = re.compile(r"\\([a-zA-Z@]+)")
_ENVIRONMENT = re.compile(r"\\(begin|end)\{([^}]*)\}")
_ITEM = re.compile(r"\\item\b")
_SECTION = re.compile(r"\\(?:sub)*section\*?[\[{]")

# Where a line sits: the environments open around it (name + opening line id, so two lists
# are never "the same place") and the brace depth.
type Nesting = tuple[tuple[tuple[str, str], ...], int]
_OUTSIDE: Nesting = ((), 0)


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


def _nesting(lines: list[tuple[str, str]]) -> tuple[dict[str, Nesting], dict[str, Nesting]]:
    """Nesting just before and just after each line."""
    envs: list[tuple[str, str]] = []
    depth = 0
    before: dict[str, Nesting] = {}
    after: dict[str, Nesting] = {}
    for line_id, text in lines:
        before[line_id] = (tuple(envs), depth)
        for kind, name in _ENVIRONMENT.findall(_code(text)):
            if kind == "begin":
                envs.append((name, line_id))
            elif envs and envs[-1][0] == name:
                envs.pop()
        depth += _brace_depth(text)
        after[line_id] = (tuple(envs), depth)
    return before, after


def _block_problem(texts: list[str]) -> str | None:
    """Why these lines can't stand alone as a block, or None if every \\begin and brace
    opened in them is also closed in them (and nothing outside is closed)."""
    envs: list[str] = []
    depth = 0
    for text in texts:
        for kind, name in _ENVIRONMENT.findall(_code(text)):
            if kind == "begin":
                envs.append(name)
            elif not envs or envs.pop() != name:
                return "closes an environment it doesn't open"
        depth += _brace_depth(text)
        if depth < 0:
            return "has unbalanced braces"
    if envs:
        return "opens an environment it doesn't close"
    return "has unbalanced braces" if depth else None


def _has_bare_item(texts: list[str]) -> bool:
    """An \\item not inside a list that the same block opens: it needs a list around it."""
    open_lists = 0
    for text in texts:
        code = _code(text)
        if _ITEM.search(code) and open_lists == 0:
            return True
        for kind, name in _ENVIRONMENT.findall(code):
            if name in _LISTS:
                open_lists += 1 if kind == "begin" else -1
    return False


def _check_commands(where: str, texts: list[str], allowed: set[str]) -> list[str]:
    used = set().union(*(_commands(text) for text in texts))
    problems = []
    if forbidden := sorted(used & _FORBIDDEN):
        problems.append(f"{where}: forbidden command(s) {', '.join(forbidden)}")
    if unknown := sorted(used - allowed - _FORBIDDEN):
        problems.append(f"{where}: command(s) not used elsewhere in the CV: {', '.join(unknown)}")
    return problems


def _check_replacement(line_id: str, text: str, original: str, allowed: set[str]) -> list[str]:
    if "\n" in text or "\r" in text:
        return [f"{line_id}: a replacement must be one line (use insert_after for more)"]
    problems = _check_commands(line_id, [text], allowed)
    if _brace_depth(text) != _brace_depth(original):
        problems.append(f"{line_id}: unbalanced braces")
    if _environments(text) != _environments(original):
        problems.append(f"{line_id}: must keep the same environment begin/end as the original")
    return problems


class _Edits:
    """One apply_edits run: the document, its nesting, and the problems found so far."""

    def __init__(self, doc: TexDocument) -> None:
        self.lines = doc.lines()
        self.text = dict(self.lines)
        self.position = {line_id: n for n, (line_id, _) in enumerate(self.lines, start=1)}
        self.before, self.after = _nesting(self.lines)
        self.allowed = set().union(*(_commands(line) for line in doc.body))
        self.environments = {
            name for line in doc.body for _, name in _ENVIRONMENT.findall(_code(line))
        }
        self.problems: list[str] = []

    def known(self, line_id: str, *, anchor: bool = False) -> bool:
        if line_id in self.text or (anchor and line_id == TOP):
            return True
        self.problems.append(f"{line_id}: unknown line id")
        return False

    def nesting_after(self, anchor: str) -> Nesting:
        return _OUTSIDE if anchor == TOP else self.after[anchor]

    def block(self, edit: EditOp) -> list[str] | None:
        """The line ids a delete/move covers, or None (problem recorded) if invalid."""
        last = edit.to or edit.line
        if not (self.known(edit.line) and self.known(last)):
            return None
        start, end = self.position[edit.line], self.position[last]
        if end < start:
            self.problems.append(f"{edit.line}: block ends before it starts")
            return None
        return [f"L{n}" for n in range(start, end + 1)]

    def is_section(self, line_id: str) -> bool:
        return bool(_SECTION.search(_code(self.text[line_id])))

    def block_problem(self, ids: list[str]) -> str | None:
        texts = [self.text[line_id] for line_id in ids]
        if problem := _block_problem(texts):
            return problem
        # A block with a heading must be whole sections: start at a heading and run up to the
        # next heading (only blank or comment lines may sit in between) or the end.
        if any(self.is_section(line_id) for line_id in ids):
            rest = self.lines[self.position[ids[-1]] :]
            next_code = next((line_id for line_id, text in rest if _code(text).strip()), None)
            ends_at_section = next_code is None or self.is_section(next_code)
            if not (self.is_section(ids[0]) and ends_at_section):
                return "must cover a whole section (heading up to the next heading)"
        return None

    def check_insert(self, edit: EditOp, texts: list[str]) -> list[str]:
        where = f"after {edit.line}"
        problems = _check_commands(where, texts, self.allowed)
        new_envs = {name for text in texts for _, name in _ENVIRONMENT.findall(_code(text))}
        if unknown := sorted(new_envs - self.environments):
            problems.append(f"{where}: environment(s) not used elsewhere in the CV: {unknown}")
        if problem := _block_problem(texts):
            problems.append(f"{where}: the inserted block {problem}")
        envs, _ = self.nesting_after(edit.line)
        if _has_bare_item(texts) and not (envs and envs[-1][0] in _LISTS):
            problems.append(f"{where}: \\item lines must go inside a list")
        return problems


def apply_edits(source: str, edits: list[EditOp]) -> str:
    doc = parse_tex(source)
    run = _Edits(doc)
    problems = run.problems

    # Pass 1: which lines each delete/move takes over. A line belongs to at most one of them.
    owner: dict[str, str] = {}
    blocks: dict[int, list[str]] = {}
    for index, edit in enumerate(edits):
        if edit.op not in ("delete", "move") or (ids := run.block(edit)) is None:
            continue
        if overlap := [line_id for line_id in ids if line_id in owner]:
            problems.append(f"{overlap[0]}: edited more than once")
            continue
        owner.update(dict.fromkeys(ids, edit.op))
        blocks[index] = ids
    deleted = {line_id for line_id, kind in owner.items() if kind == "delete"}

    # Pass 2: check each edit and record what goes where.
    replaced: dict[str, str] = {}
    attached: defaultdict[str, list[tuple[str, list[str]]]] = defaultdict(list)  # anchor -> items
    moved: set[str] = set()
    for index, edit in enumerate(edits):
        if edit.op == "replace" and run.known(edit.line) and edit.text is not None:
            if edit.line in replaced or edit.line in deleted:
                problems.append(f"{edit.line}: edited more than once")
                continue
            problems += _check_replacement(edit.line, edit.text, run.text[edit.line], run.allowed)
            replaced[edit.line] = edit.text
        elif edit.op == "delete" and index in blocks:
            if problem := run.block_problem(blocks[index]):
                problems.append(f"{edit.line}: deleted block {problem}")
        elif edit.op == "insert_after" and edit.text is not None:
            if not run.known(edit.line, anchor=True):
                continue
            if edit.line in deleted:
                problems.append(f"{edit.line}: can't insert after a deleted line")
                continue
            texts = edit.text.replace("\r", "").split("\n")
            problems += run.check_insert(edit, texts)
            attached[edit.line].append(("new", texts))
        elif edit.op == "move" and index in blocks and edit.after is not None:
            ids = blocks[index]
            if not run.known(edit.after, anchor=True):
                continue
            if edit.after in ids:
                problems.append(f"{edit.line}: can't move a line after itself")
            elif edit.after in deleted:
                problems.append(f"{edit.line}: can't move after a deleted line")
            elif problem := run.block_problem(ids):
                problems.append(f"{edit.line}: moved block {problem}")
            elif run.nesting_after(edit.after) != run.before[ids[0]]:
                problems.append(f"{edit.line}: can only move within the same list or section level")
            else:
                attached[edit.after].append(("lines", ids))
                moved.update(ids)

    out: list[str] = []
    emitted: set[str] = set()

    def emit_attached(anchor: str) -> None:
        for kind, values in attached.get(anchor, []):
            if kind == "new":
                out.extend(values)
            else:
                for line_id in values:
                    emit(line_id)

    def emit(line_id: str) -> None:
        if line_id in emitted:
            return
        emitted.add(line_id)
        if line_id not in deleted:
            out.append(replaced.get(line_id, run.text[line_id]))
        emit_attached(line_id)

    emit_attached(TOP)
    for line_id, _ in run.lines:
        if line_id not in moved:
            emit(line_id)
    # A moved line is only reachable through its anchor: unreached means anchors form a loop.
    stranded = sorted(moved - emitted, key=lambda i: int(i[1:]))
    if stranded:
        problems.append(f"{stranded[0]}: moves form a cycle")

    if problems:
        raise TexEditError(problems)
    return doc.preamble + "".join(f"{line}\n" for line in out) + doc.postamble
