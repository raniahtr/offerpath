import {
  APPLICATION_STATUSES,
  type Application,
  type ApplicationStatus,
} from "@/lib/api";
import { formatDate } from "@/lib/format";

import { STATUS_LABELS } from "./statusLabels";

interface ApplicationCardProps {
  application: Application;
  onStatusChange: (status: ApplicationStatus) => void;
  onDelete: () => void;
}

export function ApplicationCard({
  application,
  onStatusChange,
  onDelete,
}: ApplicationCardProps) {
  const { company, role, deadline, status } = application;
  const label = `${company}, ${role}`;

  return (
    <article
      aria-label={label}
      className="rounded-lg border border-line bg-surface p-3 shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-medium">{company}</h3>
          <p className="truncate text-sm text-muted">{role}</p>
        </div>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${label}`}
          className="-m-1 rounded p-1 text-muted hover:bg-mist hover:text-pine"
        >
          ✕
        </button>
      </div>

      {deadline && (
        <p className="mt-2 text-xs text-muted">Due {formatDate(deadline)}</p>
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
