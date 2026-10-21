# Implementation Plan: CV tailoring and cover letter

## Overview
For each saved posting, a guided session:
1. **Critique.** A senior recruiter specialised in the role critiques the user's CV: missing inputs, and parts not adapted to the posting.
2. **Questions.** It asks targeted questions. The answers become saved facts, reused for later postings.
3. **Tailored CV.** It produces a complete, ATS-friendly `.tex` in the user's own template, always in English.
4. **Cover letter.** It writes one in the posting's language, built on the user's answers to short motivation questions.

Every claim must trace back to the stored CV, a saved fact or a motivation answer, and code checks this.
Same rules as the fit score: strict JSON validated by Pydantic, untrusted text in tags, quota and `llm_calls`, cache by input hash, copy-paste mode.

Out of scope for v1:
- PDF compilation in the app (later: WebAssembly LaTeX in the browser)
- sending email (later: Gmail send, after Google's app review)
- auto-applying on job portals (not planned)
- a CV in any language other than English
- GitHub ingestion

## Architecture decisions
- **The LLM proposes edits, and code builds the `.tex`.** The model never writes the whole file.
  - The document body is split into numbered lines, and the model returns operations: `replace`, `insert_after`, `delete`, `move`. Each `replace` or `insert` carries `sources` (exact quotes).
  - Code applies them to the original file, so the preamble, packages and macros stay intact by construction. Every changed line is also checkable.
  - Alternative rejected: asking for a full `.tex` and diffing it. Unsourced changes slip through, and it costs about twice the output tokens.
- **Grounding check in code.**
  - Each quote must appear in the CV text, a saved fact or a motivation answer, after normalising whitespace, case and LaTeX escapes.
  - Every number in a new line (dates, %, counts) must also appear in one of its sources. This catches invented metrics, the most common fabrication.
  - Failures go back to the model once, the same way schema errors do in `generate()`, then the request is rejected.
- **Structural guards on edited lines.**
  - Braces stay balanced.
  - Only commands already used in the document body are allowed: no new packages, no `\input`, `\write18` or `\include`.
  - The preamble is byte-identical to the original.
- **Deterministic ATS lint** (no LLM), returned as warnings, not blockers:
  - standard section headings
  - layout tables or columns in the body
  - text inside graphics or TikZ
  - posting keywords from the fit analysis that are still missing
- **New data:**
  - `cv_facts` (user_id, text, label, created_at): user-confirmed facts, reusable across postings, deleted with the account.
  - `tailorings` (user_id, posting_id, critique JSONB, motivation answers JSONB, edits JSONB, tailored_tex, cover_letter, letter_language, input hashes per stage).
- **Stages are separate calls**: critique, then tailor, then letter. Each is cached, counts toward the quota and has its own copy-paste prompt and answer endpoints. This keeps each call inside Groq's free-tier tokens-per-minute.
- **Letter language:** detected by the critique call (`posting_language`), and the user can change it.
- **The UI builds on screens that don't exist yet** (CV, postings, fit score), so those come first as their own slices.

## Task list
See `tasks/todo.md`. In short:

| Phase | Tasks | What it covers |
|---|---|---|
| 1 | T1, T2 | Risky pure-Python core: edit applier and grounding check |
| 2 | T3, T4, T5 | Missing UI for the existing backend: CV, postings, fit |
| 3 | T6, T7, T8 | Facts, critique, questions |
| 4 | T9, T10, T11 | Tailored CV and ATS lint |
| 5 | T12, T13, T14 | Cover letter, privacy page, docs |

## Risks and mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| Line-based edits don't fit some templates (multi-line macros, `\resumeItem{...}` split over lines) | High | T1 is first. Test it on 3 common templates plus the owner's real `cv.tex`, locally and never committed. Fall back to grouping lines by brace depth. |
| CV plus posting plus facts exceed Groq's free tokens-per-minute | Med | Send the body only, without comments. Cap the facts sent (most recent and most relevant first). Copy-paste mode always works. |
| The grounding check is too strict (paraphrases) or too loose | Med | Quotes must be exact, but the new text can paraphrase. The number check catches the worst case. Tune on real runs at checkpoint 3. |
| Critique quality is generic ("add more keywords") | Med | The prompt needs role-specific items with section references. The owner reviews real output at checkpoint 3 before building further. |
| More personal data stored (facts, motivation answers) | Med | Scoped by user_id, deleted with the account, never logged. Privacy page updated in T13. |

## Decisions (answered 2026-10-21)
1. Cover letter: plain text, pasteable anywhere.
2. Gap-question answers are saved as facts automatically, with edit and delete in a facts list.
3. Branch: `feat/cv-tailoring` is stacked on `feat/fit-analysis` (PR #6), and gets rebased onto `main` once #6 merges.
