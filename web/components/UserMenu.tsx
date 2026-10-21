"use client";

import { useState } from "react";

import { authClient } from "@/lib/auth/client";
import { redirectToSignIn } from "@/lib/auth/session";

import { Button } from "./ui/Button";

export function UserMenu() {
  const { data } = authClient.useSession();
  const [signingOut, setSigningOut] = useState(false);
  const email = data?.user?.email;

  async function signOut() {
    setSigningOut(true);
    await authClient.signOut();
    redirectToSignIn();
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      {email && (
        <span className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="flex size-7 items-center justify-center rounded-full bg-sage-soft text-xs font-semibold text-sage-dark uppercase"
          >
            {email[0]}
          </span>
          <span className="hidden max-w-48 truncate text-muted sm:inline">
            {email}
          </span>
        </span>
      )}
      <Button variant="ghost" size="sm" onClick={signOut} disabled={signingOut}>
        Sign out
      </Button>
    </div>
  );
}
