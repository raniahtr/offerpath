"use client";

import { useState } from "react";

import {
  APPLICATION_STATUSES,
  type Application,
  type ApplicationStatus,
  type ApplicationUpdate,
} from "@/lib/api";
import { formatDate } from "@/lib/format";

import { EditApplicationForm } from "./EditApplicationForm";
import { STATUS_LABELS } from "./statusLabels";

interface ApplicationCardProps {
  application: Application;
  onStatusChange: (status: ApplicationStatus) => void;
  /** Saves edited details; throws when the API refuses. */
  onUpdate: (data: ApplicationUpdate) => Promise<void>;
  onDelete: () => void;
}

/** Only link to web addresses: a stored "javascript:..." URL would run code when clicked. */
function safeHref(url: string | null): string | null {
  return url && /^https?:\/\//i.test(url) ? url : null;
}

export function ApplicationCard({
  application,
  onStatusChange,
  onUpdate,
  onDelete,
}: ApplicationCardProps) {
  const [editing, setEditing] = useState(false);
  const { company, role, deadline, status, notes } = application;
  const label = `${company}, ${role}`;
  const href = safeHref(application.url);

  if (editing) {
    return (
      <article
        aria-label={label}
        className="rounded-lg border border-sage bg-surface p-3 shadow-sm"
      >
        <EditApplicationForm
          application={application}
          onSave={async (data) => {
            await onUpdate(data);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </article>
    );
  }

  return (
    <article
      aria-label={label}
      className="rounded-lg border border-line bg-surface p-3 shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-medium">
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-sage hover:underline"
              >
                {company}
              </a>
            ) : (
              company
            )}
          </h3>
          <p className="truncate text-sm text-muted">{role}</p>
        </div>
        <div className="-m-1 flex shrink-0">
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={`Edit ${label}`}
            className="rounded p-1 text-muted hover:bg-mist hover:text-pine"
          >
            ✎
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete ${label}`}
            className="rounded p-1 text-muted hover:bg-mist hover:text-pine"
          >
            ✕
          </button>
        </div>
      </div>

      {deadline && (
        <p className="mt-2 text-xs text-muted">Due {formatDate(deadline)}</p>
      )}
      {notes && (
        <p className="mt-2 line-clamp-2 text-xs whitespace-pre-line text-muted">
          {notes}
        </p>
      )}

      {/* The way to move a card between columns: works with touch, mouse and keyboard. */}
      <label className="mt-3 block text-xs text-muted">
        <span className="sr-only">Status for {label}</span>
        <select
          value={status}
          onChange={(e) => onStatusChange(e.target.value as ApplicationStatus)}
          className="w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-pine"
        >
          {APPLICATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </label>
    </article>
  );
}
