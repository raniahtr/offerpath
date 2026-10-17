# Offerpath web

Next.js (App Router) frontend for Offerpath. It talks to the FastAPI backend in `../api`.

## Setup

```bash
fnm use                      # Node version from .node-version (automatic on cd with fnm's shell hook)
npm ci                       # install exact versions from package-lock.json
cp .env.example .env.local   # NEXT_PUBLIC_API_URL = where the API runs
npm run dev                  # http://localhost:3000 (start the API first: docker compose up)
```

## Checks

```bash
npm run lint      # ESLint + Prettier check
npm run format    # apply Prettier formatting
npm test          # Vitest, single run (npm run test:watch to re-run on save)
npm run build     # production build, also type-checks
```
