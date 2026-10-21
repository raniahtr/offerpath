"use client";

import { useState } from "react";

import {
  APPLICATION_STATUSES,
  type Application,
  type ApplicationStatus,
  type ApplicationUpdate,
} from "@/lib/api";
import { cx } from "@/lib/cx";
import { type DeadlineTone, deadlineStatus } from "@/lib/format";
import { safeHref } from "@/lib/url";

import { EditApplicationForm } from "./EditApplicationForm";
import { STATUS_LABELS } from "./statusLabels";
import { controlClass } from "./ui/Field";
import { CalendarIcon, PencilIcon, TrashIcon } from "./ui/Icons";

interface ApplicationCardProps {
  application: Application;
  onStatusChange: (status: ApplicationStatus) => void;
  /** Saves edited details; throws when the API refuses. */
  onUpdate: (data: ApplicationUpdate) => Promise<void>;
  onDelete: () => void;
}

const DEADLINE_TONES: Record<DeadlineTone, string> = {
  overdue: "bg-rose-soft text-rose",
  soon: "bg-amber-soft text-amber",
  later: "bg-mist text-muted",
};

const iconButton =
  "rounded-md p-1.5 text-muted transition-colors hover:bg-mist hover:text-pine";

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

  const due = deadline ? deadlineStatus(deadline) : null;

  return (
    <article
      aria-label={label}
      className="group rounded-lg border border-line bg-surface p-3 shadow-xs transition-colors hover:border-muted/40"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold">
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
        {/* Always visible on touch screens; on hover/focus with a mouse. */}
        <div className="-m-1 flex shrink-0 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={`Edit ${label}`}
            className={iconButton}
          >
            <PencilIcon width={14} height={14} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete ${label}`}
            className={iconButton}
          >
            <TrashIcon width={14} height={14} />
          </button>
        </div>
      </div>

      {due && (
        <p
          className={cx(
            "mt-2 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium",
            DEADLINE_TONES[due.tone],
          )}
        >
          <CalendarIcon width={12} height={12} />
          {due.label}
        </p>
      )}
      {notes && (
        <p className="mt-2 line-clamp-2 text-xs whitespace-pre-line text-muted">
          {notes}
        </p>
      )}

      {/* The way to move a card between columns: works with touch, mouse and keyboard. */}
      <label className="mt-3 block">
        <span className="sr-only">Status for {label}</span>
        <select
          value={status}
          onChange={(e) => onStatusChange(e.target.value as ApplicationStatus)}
          className={cx(controlClass, "h-8 py-1 text-xs")}
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
