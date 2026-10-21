// Forwards the browser's sign-in requests to Neon Auth, so the session cookie is set on
// our own domain (httpOnly: page JavaScript can never read it).
import { auth } from "@/lib/auth/server";

export const { GET, POST } = auth.handler();
