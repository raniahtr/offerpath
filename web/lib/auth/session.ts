import { authClient } from "./client";

export const SIGN_IN_PATH = "/auth/sign-in";

// Refresh a little before the real expiry, so a token never expires on its way to the API.
const EXPIRY_MARGIN_MS = 30_000;

let cached: { token: string; expiresAt: number } | null = null;

/** Expiry of a JWT in ms since epoch, read from its (unverified) payload; the API verifies it. */
function expiresAt(jwt: string): number {
  try {
    const payload = jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const { exp } = JSON.parse(atob(payload)) as { exp?: unknown };
    return typeof exp === "number" ? exp * 1000 : 0;
  } catch {
    return 0; // unreadable: treat as expired, so it is never reused
  }
}

/**
 * The signed-in user's short-lived JWT for the FastAPI backend, or null when signed out.
 * Comes from Neon Auth's /token endpoint (via our /api/auth proxy). Not `session.token`:
 * that is only a JWT when the session wasn't served from the cookie cache.
 */
export async function getAccessToken(): Promise<string | null> {
  if (cached && cached.expiresAt - EXPIRY_MARGIN_MS > Date.now()) {
    return cached.token;
  }
  const { data } = await authClient.token();
  const token = data?.token ?? null;
  cached = token ? { token, expiresAt: expiresAt(token) } : null;
  return token;
}

/** Forget the cached token (on sign-out, so the next user never gets the previous one). */
export function clearAccessToken(): void {
  cached = null;
}

export function redirectToSignIn(): void {
  clearAccessToken();
  // A full page load on purpose (not router.push): it drops everything the previous
  // session left in memory and sends the next request through proxy.ts.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(SIGN_IN_PATH);
}
