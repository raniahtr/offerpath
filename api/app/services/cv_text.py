"""Turn a stored CV into the plain text sent to the LLM.

LaTeX markup roughly doubles a CV's token count, and Groq's free tier allows ~8k tokens per
minute, so we send readable text instead. The stored CV is never modified. This is a
best-effort cleanup for typical CV templates, not a LaTeX parser.
"""

import re

from app.models.cv_profile import CvFormat

_ESCAPES = {r"\&": "&", r"\%": "%", r"\$": "$", r"\#": "#", r"\_": "_", r"\{": "{", r"\}": "}"}


def latex_to_text(source: str) -> str:
    text = source
    # Only the document body: the preamble is packages and macro definitions.
    begin, end = text.find(r"\begin{document}"), text.rfind(r"\end{document}")
    if begin != -1:
        text = text[begin + len(r"\begin{document}") : end if end != -1 else None]
    text = re.sub(r"(?<!\\)%.*", "", text)  # comments (but not an escaped \%)
    text = re.sub(r"\\href\{([^}]*)\}\{([^}]*)\}", r"\2 (\1)", text)  # keep link targets
    text = re.sub(r"\\(begin|end)\{[^}]*\}(\[[^\]]*\])?(\{[^}]*\})*", "\n", text)  # environments
    text = re.sub(r"\\item\b(\[[^\]]*\])?", "\n- ", text)
    text = re.sub(r"\\(sub)*section\*?\{([^}]*)\}", r"\n\n\2\n", text)
    text = text.replace("\\\\", "\n")  # explicit line breaks
    for escaped, char in _ESCAPES.items():
        text = text.replace(escaped, f"\0{ord(char)}\0")  # protect escapes from the next steps
    # Custom template macros like \resumeEntry{Company}{Role}{Dates} -> "Company | Role | Dates".
    text = re.sub(r"\}\s*\{", " | ", text)
    text = re.sub(r"\\[a-zA-Z@]+\*?(\[[^\]]*\])?", " ", text)  # any remaining command name
    text = text.replace("{", "").replace("}", "")
    text = re.sub(r"(?<!\\)&", " | ", text)  # table column separators
    text = text.replace("~", " ").replace("---", "—").replace("--", "–")
    text = re.sub(r"\0(\d+)\0", lambda m: chr(int(m.group(1))), text)
    return normalize_whitespace(text)


def normalize_whitespace(text: str) -> str:
    lines = (re.sub(r"[ \t]+", " ", line).strip() for line in text.splitlines())
    text = "\n".join(lines)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def cv_prompt_text(content: str, cv_format: str) -> str:
    if cv_format == CvFormat.LATEX:
        return latex_to_text(content)
    return normalize_whitespace(content)
