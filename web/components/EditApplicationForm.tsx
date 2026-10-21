"use client";

import { type FormEvent, useState } from "react";

import type { Application, ApplicationUpdate } from "@/lib/api";
import { cx } from "@/lib/cx";

import { Button } from "./ui/Button";
import { controlClass } from "./ui/Field";

interface EditApplicationFormProps {
  application: Application;
  /** Saves the changes; throws (e.g. ApiError) when it fails. */
  onSave: (data: ApplicationUpdate) => Promise<void>;
  onCancel: () => void;
}

const inputClass = cx(controlClass, "mt-1 px-2 py-1.5");

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
      <label className="text-xs font-medium text-muted">
        Company
        <input
          name="company"
          required
          maxLength={200}
          defaultValue={application.company}
          className={inputClass}
        />
      </label>
      <label className="text-xs font-medium text-muted">
        Role
        <input
          name="role"
          required
          maxLength={200}
          defaultValue={application.role}
          className={inputClass}
        />
      </label>
      <label className="text-xs font-medium text-muted">
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
        <label className="text-xs font-medium text-muted">
          Applied on
          <input
            name="applied_at"
            type="date"
            defaultValue={application.applied_at ?? ""}
            className={inputClass}
          />
        </label>
        <label className="text-xs font-medium text-muted">
          Deadline
          <input
            name="deadline"
            type="date"
            defaultValue={application.deadline ?? ""}
            className={inputClass}
          />
        </label>
      </div>
      <label className="text-xs font-medium text-muted">
        CV version
        <input
          name="cv_version"
          maxLength={100}
          defaultValue={application.cv_version ?? ""}
          className={inputClass}
        />
      </label>
      <label className="text-xs font-medium text-muted">
        Notes
        <textarea
          name="notes"
          rows={3}
          defaultValue={application.notes ?? ""}
          className={inputClass}
        />
      </label>

      {error && (
        <p role="alert" className="text-sm text-rose">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={submitting}
          aria-label="Save"
        >
          {submitting ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
