"use client";

import { type FormEvent, useState } from "react";

import type { PostingCreate } from "@/lib/api";

import { Button } from "../ui/Button";
import { controlClass, Field } from "../ui/Field";
import { ErrorBanner } from "../ui/States";

// Same limit as the API (POSTING_MAX_CHARS in api/app/schemas/posting.py).
const MAX_DESCRIPTION = 20_000;

interface PostingFormProps {
  /** Saves the posting; throws (e.g. ApiError) when it fails. */
  onCreate: (data: PostingCreate) => Promise<void>;
  onCancel?: () => void;
}

function optional(fields: FormData, name: string): string | null {
  const value = String(fields.get(name) ?? "").trim();
  return value === "" ? null : value;
}

export function PostingForm({ onCreate, onCancel }: PostingFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [length, setLength] = useState(0);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);

    setSubmitting(true);
    setError(null);
    try {
      await onCreate({
        title: String(fields.get("title") ?? ""),
        company: String(fields.get("company") ?? ""),
        location: optional(fields, "location"),
        url: optional(fields, "url"),
        description: String(fields.get("description") ?? ""),
      });
      form.reset();
      setLength(0);
    } catch (e) {
      // Keep what the user pasted so they can fix it and resubmit.
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="New posting"
      className="grid gap-4 rounded-lg border border-line bg-surface p-4 shadow-xs sm:grid-cols-2"
    >
      <Field label="Job title">
        <input
          name="title"
          required
          maxLength={200}
          placeholder="e.g. Machine Learning Intern"
          className={controlClass}
        />
      </Field>
      <Field label="Company">
        <input
          name="company"
          required
          maxLength={200}
          placeholder="e.g. Roche"
          className={controlClass}
        />
      </Field>
      <Field label="Location (optional)">
        <input
          name="location"
          maxLength={200}
          placeholder="e.g. Basel, hybrid"
          className={controlClass}
        />
      </Field>
      <Field label="Link to the ad (optional)">
        <input
          name="url"
          type="url"
          maxLength={2000}
          placeholder="https://…"
          className={controlClass}
        />
      </Field>
      <Field
        label="Job description"
        hint={`Paste the whole ad: responsibilities and requirements. ${length.toLocaleString("en-US")} / ${MAX_DESCRIPTION.toLocaleString("en-US")} characters`}
        className="sm:col-span-2"
      >
        <textarea
          name="description"
          required
          maxLength={MAX_DESCRIPTION}
          rows={10}
          onChange={(e) => setLength(e.currentTarget.value.length)}
          className={controlClass}
        />
      </Field>

      {error && (
        <div className="sm:col-span-2">
          <ErrorBanner>{error}</ErrorBanner>
        </div>
      )}

      <div className="flex justify-end gap-2 sm:col-span-2">
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? "Saving…" : "Save posting"}
        </Button>
      </div>
    </form>
  );
}
