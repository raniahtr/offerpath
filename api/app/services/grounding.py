"""Check that LLM-proposed CV changes only use facts the user actually gave us.

Every new or changed line must quote at least one source, and each quote must appear in the
user's CV text, saved facts or motivation answers. Every number in the new text must appear in
its quotes or in the line it replaces: invented metrics are the most common fabrication.
Problems name line ids and quote positions only, never CV text, so they're safe to log and
to send back to the model.
"""

import re

from app.schemas.tailoring import EditOp

MIN_QUOTE_CHARS = 4

_ESCAPES = {r"\&": "&", r"\%": "%", r"\$": "$", r"\#": "#", r"\_": "_", r"\{": "", r"\}": ""}
_NUMBER = re.compile(r"\d+(?:[.,]\d+)*")
# Formatting, not claims: optional arguments ([leftmargin=0.15in]) and lengths (\vspace{2pt}).
_LAYOUT = re.compile(r"\[[^\]]*\]|-?\d+(?:\.\d+)?\s*(?:pt|in|cm|mm|em|ex|bp)\b")


def normalize(text: str) -> str:
    """Comparable form of LaTeX or plain text: no markup, one case, one kind of dash/space."""
    for escaped, char in _ESCAPES.items():
        text = text.replace(escaped, char)
    text = re.sub(r"\\[a-zA-Z@]+\*?", " ", text)  # command names (arguments are kept)
    text = re.sub(r"[{}~]", " ", text)
    text = re.sub(r"[–—]|-{2,3}", "-", text)
    text = text.replace("’", "'").replace("“", '"').replace("”", '"')
    return re.sub(r"\s+", " ", text).strip().lower()


def _contains_number(number: str, text: str) -> bool:
    return re.search(rf"(?<![\d.,]){re.escape(number)}(?![\d]|[.,]\d)", text) is not None


def check_grounding(
    edits: list[EditOp], *, sources: list[str], originals: dict[str, str]
) -> list[str]:
    """`sources`: CV text, facts and answers. `originals`: line id -> current line text."""
    corpus = [normalize(source) for source in sources]
    problems: list[str] = []
    for edit in edits:
        if edit.text is None:  # delete/move only rearrange what's already there
            continue
        where = edit.line if edit.op == "replace" else f"after {edit.line}"
        if not edit.sources:
            problems.append(f"{where}: needs at least one source")
            continue
        quotes = [normalize(quote) for quote in edit.sources]
        for position, quote in enumerate(quotes, start=1):
            if len(quote) < MIN_QUOTE_CHARS:
                problems.append(f"{where}: source {position} is too short to check")
            elif not any(quote in text for text in corpus):
                problems.append(f"{where}: source {position} is not in your CV or facts")

        backing = quotes + ([normalize(originals[edit.line])] if edit.op == "replace" else [])
        claims = normalize(_LAYOUT.sub(" ", edit.text))
        for number in dict.fromkeys(_NUMBER.findall(claims)):
            if not any(_contains_number(number, text) for text in backing):
                problems.append(f"{where}: number {number} is not in its sources")
    return problems
