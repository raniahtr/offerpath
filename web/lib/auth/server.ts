// Server-side Neon Auth: the proxy route (/api/auth/*) and the page guard (proxy.ts) use it.
// Never import this from a client component: it reads the cookie-signing secret.
import { createNeonAuth } from "@neondatabase/auth/next/server";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set (see web/.env.example)`);
  return value;
}

export const auth = createNeonAuth({
  baseUrl: requiredEnv("NEON_AUTH_BASE_URL"),
  cookies: { secret: requiredEnv("NEON_AUTH_COOKIE_SECRET") },
});
