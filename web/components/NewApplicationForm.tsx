"use client";

import { type FormEvent, useState } from "react";

import type { ApplicationCreate } from "@/lib/api";

interface NewApplicationFormProps {
  /** Saves the application; throws (e.g. ApiError) when it fails. */
  onCreate: (data: ApplicationCreate) => Promise<void>;
}

const inputClass =
  "w-full rounded-md border border-line bg-surface px-3 py-2 text-sm placeholder:text-muted/70";

export function NewApplicationForm({ onCreate }: NewApplicationFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const deadline = String(fields.get("deadline") ?? "");

    setSubmitting(true);
    setError(null);
    try {
      await onCreate({
        company: String(fields.get("company") ?? ""),
        role: String(fields.get("role") ?? ""),
        deadline: deadline || null,
      });
      form.reset();
    } catch (e) {
      // Keep what the user typed so they can fix it and resubmit.
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Add application"
      className="grid gap-2 rounded-lg border border-line bg-surface p-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end"
    >
      <label className="text-xs text-muted">
        Company
        <input name="company" required maxLength={200} className={inputClass} />
      </label>
      <label className="text-xs text-muted">
        Role
        <input name="role" required maxLength={200} className={inputClass} />
      </label>
      <label className="text-xs text-muted">
        Deadline
        <input name="deadline" type="date" className={inputClass} />
      </label>
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-sage px-4 py-2 text-sm font-medium text-white hover:bg-sage-dark disabled:opacity-60"
      >
        {submitting ? "Adding…" : "Add"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-amber sm:col-span-4">
          {error}
        </p>
      )}
    </form>
  );
}
