"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { LogoMark } from "@/components/ui/Icons";
import { ErrorBanner } from "@/components/ui/States";
import { authClient } from "@/lib/auth/client";

const PROVIDERS = [
  { id: "google", label: "Google" },
  { id: "github", label: "GitHub" },
] as const;

type ProviderId = (typeof PROVIDERS)[number]["id"];

const FEATURES = [
  "Track every application on one board",
  "See how well your CV fits a posting",
  "Tailor your CV without inventing anything",
];

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
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-8 shadow-sm">
        <LogoMark width={36} height={36} />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">
          Offerpath
        </h1>
        <p className="mt-1 text-sm text-muted">
          Sign in to track your internship applications.
        </p>

        <ul className="mt-5 grid gap-1.5 text-sm">
          {FEATURES.map((feature) => (
            <li key={feature} className="flex items-start gap-2">
              <span
                aria-hidden="true"
                className="mt-1.5 size-1.5 shrink-0 rounded-full bg-sage"
              />
              {feature}
            </li>
          ))}
        </ul>

        <div className="mt-6 grid gap-2">
          {PROVIDERS.map(({ id, label }) => (
            <Button
              key={id}
              onClick={() => signIn(id)}
              disabled={pending !== null}
              className="h-10 w-full"
            >
              {pending === id ? "Redirecting…" : `Continue with ${label}`}
            </Button>
          ))}
        </div>
        {error && (
          <div className="mt-4">
            <ErrorBanner>{error}</ErrorBanner>
          </div>
        )}
        <p className="mt-6 text-xs text-muted">
          No password to remember: you sign in with an account you already
          have. Your data is visible only to you.
        </p>
      </div>
    </main>
  );
}
