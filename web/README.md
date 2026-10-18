# Offerpath web

Next.js (App Router) frontend for Offerpath. It talks to the FastAPI backend in `../api`.

## Setup

```bash
fnm use                      # Node version from .node-version (automatic on cd with fnm's shell hook)
npm ci                       # install exact versions from package-lock.json
cp .env.example .env.local   # API URL + Neon Auth settings (see comments in the file)
npm run dev                  # http://localhost:3000 (start the API first: docker compose up)
```

## Sign-in

Users sign in with Google or GitHub through Neon Auth; there are no passwords.

- `app/api/auth/[...path]/route.ts` proxies sign-in requests to Neon Auth, so the session
  cookie is set on our own domain and is `httpOnly`.
- `proxy.ts` redirects signed-out visitors to `/auth/sign-in` and completes the OAuth login.
- `lib/auth/session.ts` fetches a short-lived JWT from Neon's `/token` endpoint and caches it
  until shortly before it expires; `lib/api.ts` sends it as `Authorization: Bearer`, and a 401
  sends the user back to sign in.

Locally, use the Neon `dev` branch's auth URL, so test accounts never mix with real users.

## Checks

```bash
npm run lint      # ESLint + Prettier check
npm run format    # apply Prettier formatting
npm test          # Vitest, single run (npm run test:watch to re-run on save)
npm run build     # production build, also type-checks
```
