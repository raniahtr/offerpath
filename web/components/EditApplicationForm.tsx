"use client";

import { type FormEvent, useState } from "react";

import type { Application, ApplicationUpdate } from "@/lib/api";

interface EditApplicationFormProps {
  application: Application;
  /** Saves the changes; throws (e.g. ApiError) when it fails. */
  onSave: (data: ApplicationUpdate) => Promise<void>;
  onCancel: () => void;
}

const inputClass =
  "mt-0.5 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-pine";

/** Empty optional fields are sent as null, so clearing a field clears it in the database. */
function optional(fields: FormData, name: string): string | null {
  const value = String(fields.get(name) ?? "").trim();
  return value === "" ? null : value;
}

export function EditApplicationForm({
  application,
  onSave,
  onCancel,
}: EditApplicationFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);

    setSubmitting(true);
    setError(null);
    try {
      await onSave({
        company: String(fields.get("company") ?? ""),
        role: String(fields.get("role") ?? ""),
        url: optional(fields, "url"),
        applied_at: optional(fields, "applied_at"),
        deadline: optional(fields, "deadline"),
        cv_version: optional(fields, "cv_version"),
        notes: optional(fields, "notes"),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label={`Edit ${application.company}, ${application.role}`}
      className="flex flex-col gap-2"
    >
      <label className="text-xs text-muted">
        Company
        <input
          name="company"
          required
          maxLength={200}
          defaultValue={application.company}
          className={inputClass}
        />
      </label>
      <label className="text-xs text-muted">
        Role
        <input
          name="role"
          required
          maxLength={200}
          defaultValue={application.role}
          className={inputClass}
        />
      </label>
      <label className="text-xs text-muted">
        Posting URL
        <input
          name="url"
          type="url"
          maxLength={2000}
          defaultValue={application.url ?? ""}
          className={inputClass}
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-muted">
          Applied on
          <input
            name="applied_at"
            type="date"
            defaultValue={application.applied_at ?? ""}
            className={inputClass}
          />
        </label>
        <label className="text-xs text-muted">
          Deadline
          <input
            name="deadline"
            type="date"
            defaultValue={application.deadline ?? ""}
            className={inputClass}
          />
        </label>
      </div>
      <label className="text-xs text-muted">
        CV version
        <input
          name="cv_version"
          maxLength={100}
          defaultValue={application.cv_version ?? ""}
          className={inputClass}
        />
      </label>
      <label className="text-xs text-muted">
        Notes
        <textarea
          name="notes"
          rows={3}
          defaultValue={application.notes ?? ""}
          className={inputClass}
        />
      </label>

      {error && (
        <p role="alert" className="text-sm text-amber">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-3 py-1.5 text-sm text-muted hover:bg-mist hover:text-pine"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-sage px-3 py-1.5 text-sm font-medium text-white hover:bg-sage-dark disabled:opacity-60"
        >
          {submitting ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
