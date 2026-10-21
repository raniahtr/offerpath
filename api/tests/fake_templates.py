"""Three common CV template styles, filled with an invented person (never real personal data)."""

# Jake's-resume style: custom macros wrap every entry and bullet.
JAKE_STYLE = r"""\documentclass[letterpaper,11pt]{article}
\usepackage{enumitem}
\usepackage[hidelinks]{hyperref}
\newcommand{\resumeItem}[1]{\item\small{#1}}
\newcommand{\resumeSubheading}[4]{\item \textbf{#1} \hfill #2 \\ \textit{#3} \hfill \textit{#4}}
\newcommand{\resumeItemListStart}{\begin{itemize}}
\newcommand{\resumeItemListEnd}{\end{itemize}}
\begin{document}
\begin{center}
  \textbf{\Large Ada Example} \\
  \href{mailto:ada@example.com}{ada@example.com}
\end{center}
\section{Experience}
\begin{itemize}[leftmargin=0.15in, label={}]
  \resumeSubheading{Acme Labs}{Zurich}{ML Intern}{2025 -- 2026}
  \resumeItemListStart
    \resumeItem{Trained \textbf{PyTorch} models on 10\% of R\&D data}
    \resumeItem{Shipped a FastAPI service with Docker}
  \resumeItemListEnd
\end{itemize}
\section{Skills}
\textbf{Languages}{: Python, TypeScript, SQL}
\end{document}
"""

# moderncv: the class provides the entry macros, and personal data sits in the preamble.
MODERNCV = r"""\documentclass[11pt,a4paper]{moderncv}
\moderncvstyle{classic}
\name{Ada}{Example}
\email{ada@example.com}
\begin{document}
\makecvtitle
\section{Education}
\cventry{2024--2026}{M.Sc. Neuroscience}{Example University}{Lausanne}{}{}
\section{Projects}
\cventry{2025}{Spike sorter}{Course project}{}{}{Clustered neural recordings with scikit-learn}
\cvitem{Skills}{Python, NumPy, PyTorch}
\end{document}
"""

# Sections of entries: a one-line header macro, then that entry's own bullet list.
ENTRIES = r"""\documentclass{article}
\newcommand{\entry}[2]{\textbf{#1} \hfill #2 \\}
\begin{document}
\section{Experience}
\entry{ML Intern, Acme Labs}{2025--2026}
\begin{itemize}
  \item Trained \textbf{PyTorch} models on 10\% of R\&D data
  \item Shipped a FastAPI service with Docker
\end{itemize}

% --- Projects ---
\section{Projects}
\entry{Spike sorter}{2025}
\begin{itemize}
  \item Clustered neural recordings with scikit-learn
\end{itemize}
\entry{Campus app}{2024}
\begin{itemize}
  \item Built a React Native app
\end{itemize}
\end{document}
"""

# Plain article class with standard environments only.
PLAIN_ARTICLE = r"""\documentclass{article}
\begin{document}
\section*{Ada Example}
ada@example.com

\section*{Experience}
\textbf{Acme Labs}, ML Intern, 2025--2026
\begin{itemize}
  \item Built a data pipeline in Python % keep: real comment
  \item Wrote unit tests with pytest
\end{itemize}
\end{document}
"""
