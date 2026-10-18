# Offerpath

Track internship applications, find matching postings, and tailor a CV to each one.

A multi-user web app (each person signs in and sees only their own data), and a public
portfolio project. Hosted on free tiers only. Code quality, tests and a clear deployment
pipeline matter as much as features.

Developer-specific context (background, preferences) lives in `CLAUDE.local.md`, which is git-ignored.

## Working agreement
- **Plan before coding.** For any non-trivial feature, propose a short plan (files touched, data model changes, tests) and wait for approval.
- **Thin vertical slices.** One feature end to end (DB → API → UI → test) before starting the next.
- **Explain infrastructure.** For Dockerfiles, docker-compose, GitHub Actions, deploy configs and migrations, explain what each non-obvious line does and why. Don't silently generate infra.
- **Small, reviewable changes.** Prefer several small commits over one large one; suggest a commit after each working step.
- **Ask, don't guess,** when a requirement is ambiguous or a choice is hard to undo (schema design, auth, hosting).
- Keep dependencies minimal. Justify any new library in one line.

## Stack
| Layer | Choice |
|---|---|
| Frontend | Next.js (App Router) + TypeScript + Tailwind, in `/web` |
| Backend | FastAPI + Pydantic v2 + SQLAlchemy 2.0, in `/api` (deps managed with uv) |
| Database | Postgres 18 with pgvector (local, CI and Neon on the same major); migrations with Alembic |
| LLM | Claude API, structured outputs validated with Pydantic |
| Local dev | Docker Compose (api + db) |
| CI | GitHub Actions: lint + tests on every PR |
| Auth | Neon Auth (Google/GitHub sign-in, no passwords); the API verifies JWTs itself via JWKS |
| Hosting | Vercel Hobby (web + api as a Python function), Neon free (db + auth, Frankfurt) |

## Repository layout
```
/web        Next.js frontend
/api        FastAPI backend
  /app
    main.py
    models/     SQLAlchemy models
    schemas/    Pydantic request/response + LLM output schemas
    routers/    API routes
    services/   business logic (LLM calls, matching, CV parsing)
  /tests
  /alembic
/resume     CV as LaTeX (cv.tex, git-ignored) — source of truth for CV content
/infra      deployment configs
docker-compose.yml
```

## Commands
```bash
cp .env.example .env               # first-time setup: local env vars
docker compose up --build          # start api + db locally
docker compose exec api pytest     # run backend tests
cd api && uv run pytest            # run backend tests without Docker (needs the compose db running)
cd api && uv run ruff check . && uv run ruff format --check .  # lint
docker compose exec api alembic upgrade head   # apply migrations (also runs on api startup)
docker compose exec api alembic revision --autogenerate -m "<message>"  # new migration from model changes
docker compose exec api alembic check          # fail if models and migrations are out of sync
docker compose down -v             # reset the local db volume (re-runs infra/db/init.sql)
cd web && fnm use                  # Node version from web/.node-version (fnm's shell hook does this on cd)
cd web && npm ci                   # install exact frontend deps from package-lock.json
cp web/.env.example web/.env.local # first-time setup: NEXT_PUBLIC_API_URL for the frontend
cd web && npm run dev              # frontend dev server on :3000 (start the compose api first)
cd web && npm run lint && npm test # ESLint + Prettier check, Vitest (API mocked, no backend needed)
cd web && npm run format           # apply Prettier formatting
cd web && npm run build            # production build, also type-checks the app
cd infra/neon && npm ci            # Neon CLI + config packages (pinned)
cd infra/neon && npx neon checkout dev  # pin the dev branch; pulls its env into infra/neon/.env.local (git-ignored)
cd infra/neon && npm run plan       # preview what neon.ts would change on the pinned branch
cd infra/neon && npm run deploy     # apply neon.ts (never pulls credentials)
```
Keep this section up to date when commands change.

## Conventions
- Python: type hints everywhere, Ruff for lint/format, pytest for tests.
- TypeScript: strict mode, ESLint + Prettier, no `any`.
- API: REST, JSON, plural resource names (`/applications`, `/postings`).
- Every new endpoint gets at least one test (happy path + one failure case).
- **User data is always scoped to the signed-in user**: every query filters on `user_id` from the
  verified token (never from the request body), someone else's row is a 404, and every new
  endpoint gets a test proving user B can't read or change user A's data.
- Config via environment variables only. Never hardcode secrets; document new variables in `.env.example`.
- Git: feature branches → PR to `main`. Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `ci:`).

## Core data model (MVP)
- `Application`: user_id (owner), company, role, url, status (`saved | applied | interview | offer | rejected`),
  applied_at, deadline, notes, cv_version.
- `Posting`: title, company, location, description, source, url.
- `FitAnalysis`: posting_id, score (0–100), matched_skills, missing_skills, cv_suggestions, explanation.

## LLM rules (important)
- All LLM outputs must be parsed into a Pydantic schema; reject and retry on invalid output.
- **Never invent CV content.** Suggestions may only rephrase, reorder or surface facts that exist
  in `/resume/cv.tex`, the owner's GitHub repos, or the owner's own notes. Each suggestion must cite its source.
- Cache LLM responses by input hash; never call the API in tests (mock it).
- Never log full CV text or API keys.

## MVP scope
1. Docker Compose with api + db, health endpoint, CI running tests.
2. Applications CRUD + kanban board.
3. Sign-in + per-user data, deployed to Vercel (web + api) + Neon, privacy page and account deletion.
4. Paste a job description → structured fit score + CV suggestions.

## Out of scope for now
Automated job scraping, GitHub repo ingestion, Gmail integration, paid plans or billing, evals in CI.
Don't build these unless explicitly requested.

## Privacy
Users' applications and CVs are personal data (GDPR / Swiss nFADP): they never go into the
repository, logs or error messages. Use seed/fake data for tests and demos. Never commit `.env` files.
Store only what a feature needs, and keep the privacy page in sync with which services process data.
