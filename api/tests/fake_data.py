"""Fake CV and posting used across tests. Invented person: never real personal data."""

FAKE_CV_LATEX = r"""
\documentclass[11pt]{article}
\usepackage{hyperref}
\newcommand{\resumeEntry}[3]{\textbf{#1} \hfill #3 \\ \textit{#2}}
\begin{document}
\section*{Ada Example}
% private note: this comment must never reach the LLM
\href{mailto:ada@example.com}{ada@example.com}
\section{Experience}
\resumeEntry{Acme Labs}{ML Intern}{2025 -- 2026}
\begin{itemize}
  \item Trained \textbf{PyTorch} models on 10\% of R\&D data
  \item Shipped a \emph{FastAPI} service with Docker
\end{itemize}
\end{document}
"""

FAKE_POSTING = {
    "title": "ML Engineering Intern",
    "company": "Globex",
    "location": "Zurich",
    "description": "We need Python, PyTorch and Kubernetes experience.",
}

FIT_JSON = (
    '{"score": 72, "matched_skills": ["Python", "PyTorch"], '
    '"missing_skills": ["Kubernetes"], "explanation": "You fit most requirements."}'
)


def make_pdf(text: str) -> bytes:
    """A minimal valid one-page PDF showing `text` (enough for pypdf to extract it)."""
    content = f"BT /F1 12 Tf 72 720 Td ({text}) Tj ET".encode()
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
        b"<< /Length %d >>\nstream\n" % len(content) + content + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for number, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % number + body + b"\nendobj\n"
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objects) + 1)
    out += b"".join(b"%010d 00000 n \n" % offset for offset in offsets)
    out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (
        len(objects) + 1,
        xref,
    )
    return bytes(out)
