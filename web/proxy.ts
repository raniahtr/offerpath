// Runs before every matched request (Next 16's name for middleware). Signed-out visitors
// are redirected to the sign-in page, and it finishes the OAuth login when GitHub/Google
// send the user back, so it must also cover "/".
import { auth } from "@/lib/auth/server";

export default auth.middleware({ loginUrl: "/auth/sign-in" });

export const config = {
  // Everything except the auth proxy itself and static assets.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
