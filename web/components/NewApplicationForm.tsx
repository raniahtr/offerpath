"use client";

import { type FormEvent, useState } from "react";

import type { ApplicationCreate } from "@/lib/api";

import { Button } from "./ui/Button";
import { controlClass, Field } from "./ui/Field";
import { PlusIcon } from "./ui/Icons";

interface NewApplicationFormProps {
  /** Saves the application; throws (e.g. ApiError) when it fails. */
  onCreate: (data: ApplicationCreate) => Promise<void>;
}

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
      // Ready for the next one without reaching for the mouse.
      form.querySelector<HTMLInputElement>("input[name=company]")?.focus();
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
      className="grid gap-3 rounded-lg border border-line bg-surface p-3 shadow-xs sm:grid-cols-[1fr_1fr_10rem_auto] sm:items-end"
    >
      <Field label="Company">
        <input
          name="company"
          required
          maxLength={200}
          placeholder="e.g. Roche"
          className={controlClass}
        />
      </Field>
      <Field label="Role">
        <input
          name="role"
          required
          maxLength={200}
          placeholder="e.g. Data Science Intern"
          className={controlClass}
        />
      </Field>
      <Field label="Deadline">
        <input name="deadline" type="date" className={controlClass} />
      </Field>
      <Button
        type="submit"
        variant="primary"
        disabled={submitting}
        aria-label="Add"
      >
        <PlusIcon width={14} height={14} />
        {submitting ? "Adding…" : "Add"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-rose sm:col-span-4">
          {error}
        </p>
      )}
    </form>
  );
}
