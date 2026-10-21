# Tasks: CV tailoring and cover letter

Plan and design decisions: `tasks/plan.md`.

Every task:
- passes `cd api && uv run pytest`, `uv run ruff check . && uv run ruff format --check .`, and `cd web && npm run lint && npm test && npm run build`
- gets a happy-path test, a failure test and a user-B-can't-touch-user-A test for each new endpoint
- uses FakeLlm only, never the real API
- ends with a commit suggestion

## Phase 1: Risky core (pure Python, no LLM, no database)

### T1: Block-aware `.tex` edit applier ✅ (checked on the owner's real CV)
**Description:** Split a `.tex` file into its preamble and numbered body lines. Then apply a list of `replace`, `insert_after`, `delete` and `move` operations and rebuild the file. Reject anything that would break the structure.
**Acceptance criteria:**
- [x] The preamble is byte-identical, and lines nobody edited are unchanged.
- [x] Rejected with a clear reason, never silently applied:
  - unbalanced braces
  - a command not already used in the body
  - `\input`, `\include` or `\write18`
  - an unknown line id
  - two operations on the same line
- [x] Works on 3 fixture templates (Jake's resume style, moderncv, plain article). These are fake data in `api/tests/fake_templates.py`.
- [x] Also rejects: lines that would break an environment, multi-line replacements, anchors on deleted lines, and move cycles.
- [x] Blocks (added after checkpoint 1):
  - `move` and `delete` take a line range (`to`), so whole entries and sections can move or go.
  - `insert_after` accepts a multi-line balanced block, so a new entry can be added.
  - A bullet only moves within its own list, so work is never credited to another entry.
  - A section heading only moves or goes away with its whole section.
  - Bare `\item` lines can only be inserted into a list.
**Verification:** `uv run pytest tests/test_tex_edits.py` (40 tests). Manual: 14 realistic scenarios on the owner's real `resume/cv.tex` (local, never committed). All behave as intended. Compiling the output in Overleaf is still pending.
**Dependencies:** none
**Files:** `api/app/services/tex_edits.py`, `api/app/schemas/tailoring.py` (`EditOp`), `api/tests/test_tex_edits.py`, `api/tests/fake_templates.py` (+ ENTRIES template)
**Scope:** M

### T2: Grounding check ✅
**Description:** Check that each source quote exists in the CV text, a saved fact or a motivation answer, and that every number in the new text appears in its sources.
**Acceptance criteria:**
- [x] Quotes match after normalising whitespace, case and LaTeX escapes (reuses `cv_text.latex_to_text`).
- [x] An invented metric ("increased accuracy by 30%" when no source has 30) fails, with the failing line id and reason.
- [x] The error messages contain line ids and reasons, never CV text, so they're safe to log and to send back to the model.
**Verification:** `uv run pytest tests/test_grounding.py` (10 tests). Also: a replaced line may keep the numbers it already had, quotes shorter than 4 characters don't count, and numbers match as whole numbers (1 doesn't match 10).
**Dependencies:** none
**Files:** `api/app/services/grounding.py`, `api/tests/test_grounding.py`
**Scope:** S

### Checkpoint 1
- [ ] Tests and lint pass.
- [x] T1 handles the owner's real template. It needed block-aware edits, now added.
- [ ] The owner compiles one tailored output in Overleaf.
- [ ] Known limit: a number only has to appear in one of the quotes, not in the quote it belongs to. The T11 UI shows the sources for each change so you can spot a borrowed date.
- [ ] Human review.

## Phase 2: UI for the existing backend (prerequisite screens)

### T3: CV page
**Description:** `/cv` page: paste the `.tex` (or upload a PDF), save it, see when it was last saved, delete it.
**Acceptance criteria:**
- [ ] Saving and reloading shows the stored CV, and errors show up in the UI.
- [ ] Linked from the header.
**Verification:** `npm test` (API mocked). Manual: paste a real CV and reload.
**Dependencies:** none
**Files:** `web/app/cv/page.tsx`, `web/components/CvEditor.tsx` (+ test), `web/lib/api.ts`
**Scope:** M

### T4: Postings list and create
**Description:** `/postings`: paste a posting (title, company, location, url, description), list your postings, delete one.
**Acceptance criteria:**
- [ ] Create, list and delete work against the API.
- [ ] Validation errors are shown.
**Verification:** `npm test`. Manual: create 2 postings.
**Dependencies:** none
**Files:** `web/app/postings/page.tsx`, `web/components/PostingForm.tsx` (+ test), `web/lib/api.ts`
**Scope:** M

### T5: Posting detail with fit score
**Description:** `/postings/[id]`: the description, a fit result (score, matched and missing skills, explanation), an "Analyse" button, and the copy-paste flow (copy the prompt, paste the answer).
**Acceptance criteria:**
- [ ] Shows the cached or new analysis.
- [ ] Quota-reached (429), no-CV (409) and invalid pasted answer (422) each get a clear message.
**Verification:** `npm test`. Manual: run one real Groq analysis and one copy-paste analysis.
**Dependencies:** T3, T4
**Files:** `web/app/postings/[id]/page.tsx`, `web/components/FitPanel.tsx` (+ test), `web/lib/api.ts`
**Scope:** M

### Checkpoint 2
- [ ] The full flow works in the browser: paste CV, add posting, get a fit score.
- [ ] Human review, then a PR. This alone finishes the frontend for MVP step 4's fit score.

## Phase 3: Facts and critique

### T6: Saved facts (`cv_facts`)
**Description:** Model, migration and CRUD at `/facts` for facts the user adds about themselves, reused in every tailoring. Deleted with the account.
**Acceptance criteria:**
- [ ] CRUD scoped to the owner, and another user's fact returns 404.
- [ ] `DELETE /me` removes them.
- [ ] `alembic check` is clean.
**Verification:** `uv run pytest tests/test_facts.py tests/test_me.py`
**Dependencies:** none
**Files:** `api/app/models/cv_fact.py`, migration `0004`, `api/app/schemas/fact.py`, `api/app/routers/facts.py`, `api/tests/test_facts.py`
**Scope:** M

### T7: Critique stage (backend)
**Description:** `tailorings` table. `POST /postings/{id}/tailoring/critique` returns:
- issues (section, problem, severity)
- gap questions (question, why it matters)
- posting language

The prompt is "senior recruiter specialised in this role", with the CV, posting and saved facts in tags. Cached, counts toward the quota, recorded in `llm_calls`, with `.../critique/prompt` and `.../critique/manual` for copy-paste.
**Acceptance criteria:**
- [ ] The FakeLlm returns a critique, which is stored and cached. A second identical call makes no LLM call.
- [ ] No CV returns 409, quota reached returns 429, and another user's posting returns 404.
- [ ] A manual answer is validated against the same schema.
**Verification:** `uv run pytest tests/test_tailoring_critique.py`
**Dependencies:** T6
**Files:** `api/app/models/tailoring.py`, migration `0005`, `api/app/schemas/tailoring.py`, `api/app/services/tailoring.py`, `api/app/routers/tailoring.py`, test
**Scope:** M (5 files, at the limit)

### T8: Critique UI
**Description:** A "Tailor" tab on the posting detail page.
- Shows the critique grouped by section.
- Each gap question has an answer box, and answers are saved as facts.
- A facts list where you can edit and delete facts.
**Acceptance criteria:**
- [ ] Answering a question creates a fact that's visible in the facts list.
- [ ] Copy-paste mode works for the critique.
**Verification:** `npm test`. Manual: real critique of the owner's CV against a real posting.
**Dependencies:** T5, T7
**Files:** `web/components/TailorPanel.tsx`, `web/components/FactsList.tsx` (+ tests), `web/lib/api.ts`
**Scope:** M

### Checkpoint 3: quality gate
- [ ] The owner judges the critique on 2–3 real postings: is it specific and role-aware? Iterate on the prompt (bump `PROMPT_VERSION`) before building the next phase.
- [ ] Human review, then a PR.

## Phase 4: Tailored CV

### T9: Tailor stage (backend)
**Description:** `POST /postings/{id}/tailoring/cv`. The model gets the numbered body lines, the critique, the facts and the posting, and returns edit operations with sources. Code applies them (T1) and checks them (T2). A failure goes back to the model once, then the request returns 422 with the reasons. Stores the edits and the tailored `.tex`. Copy-paste endpoints too.
**Acceptance criteria:**
- [ ] FakeLlm edits with valid sources produce the expected `.tex`.
- [ ] An edit with a made-up quote is retried and then rejected, and the original CV is never modified.
- [ ] Cached by input hash (CV + facts + posting + critique + prompt version + model).
**Verification:** `uv run pytest tests/test_tailoring_cv.py`
**Dependencies:** T1, T2, T7
**Files:** `api/app/services/tailoring.py`, `api/app/routers/tailoring.py`, `api/app/schemas/tailoring.py`, test
**Scope:** M

### T10: ATS lint
**Description:** Deterministic warnings on the tailored `.tex`: non-standard headings, layout tables or columns, text in graphics, posting keywords still missing (from the fit analysis). Returned with the tailor result.
**Acceptance criteria:**
- [ ] Each rule has a fixture that triggers it and one that doesn't.
**Verification:** `uv run pytest tests/test_ats_lint.py`
**Dependencies:** T9
**Files:** `api/app/services/ats_lint.py`, test, plus the tailor response schema
**Scope:** S

### T11: Tailored CV UI
**Description:** Shows each change as before and after, with its source quotes. The user can reject single changes, which rebuilds the file without them (no new LLM call). ATS warnings are listed. Buttons to copy and download the `.tex`.
**Acceptance criteria:**
- [ ] Rejecting a change updates the downloaded `.tex`.
- [ ] Every change shows at least one source.
**Verification:** `npm test`. Manual: paste the output into Overleaf. It compiles, and you'd send it after minor tweaks.
**Dependencies:** T9, T10
**Files:** `web/components/TailoredCv.tsx` (+ test), `web/lib/api.ts`. Rejecting changes needs a small `PATCH` endpoint on the API.
**Scope:** M

### Checkpoint 4
- [ ] Real end-to-end run on the owner's CV: it compiles in Overleaf, and the grounding check holds (no invented content).
- [ ] Human review, then a PR.

## Phase 5: Cover letter and finish

### T12: Cover letter (backend + UI)
**Description:**
- 3–4 fixed motivation questions: why this company, a story that drew you to the field, what you'd want to work on there, plus one optional open question.
- The answers are stored on the tailoring.
- `POST .../tailoring/letter` writes the letter in the detected language, which the user can change.
- The output is paragraphs with sources, grounding-checked against the CV, facts and motivation answers.
- Copy-paste mode is included.
**Acceptance criteria:**
- [ ] A French posting gives a French letter. The language can be changed.
- [ ] Personal content comes from the motivation answers, and a claim without a source is rejected.
- [ ] Copy works in the UI.
**Verification:** `uv run pytest tests/test_tailoring_letter.py`, `npm test`. Manual: one letter in English and one in French.
**Dependencies:** T9 (shares service, router and grounding)
**Files:** `api/app/services/tailoring.py`, `api/app/routers/tailoring.py`, `api/app/schemas/tailoring.py`, `web/components/CoverLetter.tsx` (+ test)
**Scope:** M. If it grows, split into T12a (backend) and T12b (UI).

### T13: Privacy and account deletion
**Description:** The privacy page states that facts and motivation answers are stored and sent to the LLM provider. `DELETE /me` covers `cv_facts` and `tailorings`, with a test.
**Acceptance criteria:**
- [ ] `test_me` proves nothing remains for the user after deletion.
- [ ] The privacy text matches the data actually stored.
**Dependencies:** T6, T7. The privacy page itself is part of the deploy work, MVP step 3.
**Scope:** S

### T14: Docs
**Description:** Update `CLAUDE.md`'s data model (`CvFact`, `Tailoring`), its commands if any changed, and the README feature list.
**Scope:** XS

### Checkpoint 5: complete
- [ ] All acceptance criteria met, CI green, and the owner has used it for one real application.
