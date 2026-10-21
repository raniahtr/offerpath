"use client";

import { useState } from "react";

import { authClient } from "@/lib/auth/client";

const PROVIDERS = [
  { id: "google", label: "Google" },
  { id: "github", label: "GitHub" },
] as const;

type ProviderId = (typeof PROVIDERS)[number]["id"];

export default function SignInPage() {
  const [pending, setPending] = useState<ProviderId | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signIn(provider: ProviderId) {
    setPending(provider);
    setError(null);
    // Absolute URL: the provider redirects back via Neon Auth, which is on another domain.
    const { error } = await authClient.signIn.social({
      provider,
      callbackURL: `${window.location.origin}/`,
    });
    // On success the browser is already navigating away to the provider.
    if (error) {
      setError(error.message ?? "Sign-in failed, please try again.");
      setPending(null);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-12">
      <h1 className="mb-1 text-2xl font-semibold">Offerpath</h1>
      <p className="mb-6 text-sm text-muted">
        Sign in to track your internship applications.
      </p>
      <div className="grid gap-3">
        {PROVIDERS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => signIn(id)}
            disabled={pending !== null}
            className="rounded-md border border-line bg-surface px-4 py-2 text-sm font-medium hover:bg-sage-soft disabled:opacity-60"
          >
            {pending === id ? "Redirecting…" : `Continue with ${label}`}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-4 text-sm text-amber">
          {error}
        </p>
      )}
    </main>
  );
}
