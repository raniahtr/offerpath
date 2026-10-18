"use client";

import { useState } from "react";

import { authClient } from "@/lib/auth/client";
import { redirectToSignIn } from "@/lib/auth/session";

export function UserMenu() {
  const { data } = authClient.useSession();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    await authClient.signOut();
    redirectToSignIn();
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      {data?.user && (
        <span className="hidden text-muted sm:inline">{data.user.email}</span>
      )}
      <button
        type="button"
        onClick={signOut}
        disabled={signingOut}
        className="rounded-md border border-line px-3 py-1.5 hover:bg-sage-soft disabled:opacity-60"
      >
        Sign out
      </button>
    </div>
  );
}
