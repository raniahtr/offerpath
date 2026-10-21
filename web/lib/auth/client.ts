// Browser-side Neon Auth client. It talks to our own /api/auth proxy, never to Neon directly.
import { createAuthClient } from "@neondatabase/auth/next";

export const authClient = createAuthClient();
