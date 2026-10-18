"use client";

import { useEffect, useState } from "react";

import {
  APPLICATION_STATUSES,
  type Application,
  type ApplicationCreate,
  type ApplicationStatus,
  type ApplicationUpdate,
  createApplication,
  deleteApplication,
  listApplications,
  updateApplication,
} from "@/lib/api";

import { ApplicationCard } from "./ApplicationCard";
import { NewApplicationForm } from "./NewApplicationForm";
import { STATUS_LABELS } from "./statusLabels";

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

export function Board() {
  const [applications, setApplications] = useState<Application[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Ignore the response if the component unmounted while the request was in flight.
    let cancelled = false;
    listApplications()
      .then((data) => !cancelled && setApplications(data))
      .catch((e: unknown) => !cancelled && setError(errorText(e)));
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreate(data: ApplicationCreate) {
    const created = await createApplication(data);
    setApplications((current) => [created, ...(current ?? [])]);
  }

  // Not optimistic: the edit form stays open (showing "Saving…") until the API confirms,
  // then the card shows what the API actually stored.
  async function handleUpdate(id: number, data: ApplicationUpdate) {
    const updated = await updateApplication(id, data);
    setApplications((current) =>
      (current ?? []).map((a) => (a.id === id ? updated : a)),
    );
  }

  // Optimistic update: move the card immediately, then put it back if the API refuses.
  async function handleStatusChange(id: number, status: ApplicationStatus) {
    const previous = applications?.find((a) => a.id === id)?.status;
    const setStatus = (s: ApplicationStatus) =>
      setApplications((current) =>
        (current ?? []).map((a) => (a.id === id ? { ...a, status: s } : a)),
      );

    setError(null);
    setStatus(status);
    try {
      await updateApplication(id, { status });
    } catch (e) {
      if (previous) setStatus(previous);
      setError(`Could not move the card: ${errorText(e)}`);
    }
  }

  async function handleDelete(application: Application) {
    if (
      !window.confirm(`Delete ${application.company}, ${application.role}?`)
    ) {
      return;
    }
    setError(null);
    setApplications((current) =>
      (current ?? []).filter((a) => a.id !== application.id),
    );
    try {
      await deleteApplication(application.id);
    } catch (e) {
      setApplications((current) => [application, ...(current ?? [])]);
      setError(`Could not delete: ${errorText(e)}`);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <NewApplicationForm onCreate={handleCreate} />

      {error && (
        <p
          role="alert"
          className="rounded-md bg-amber-soft px-3 py-2 text-sm text-amber"
        >
          {error}
        </p>
      )}

      {applications === null ? (
        !error && <p className="text-sm text-muted">Loading applications…</p>
      ) : (
        // Phones: one column per screen, swipe sideways (snap). md and up: all five side by side.
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-5 md:overflow-visible md:px-0">
          {APPLICATION_STATUSES.map((status) => {
            const cards = applications.filter((a) => a.status === status);
            const headingId = `column-${status}`;
            return (
              <section
                key={status}
                aria-labelledby={headingId}
                className="flex w-[85%] shrink-0 snap-start flex-col gap-2 rounded-xl bg-sage-soft/50 p-2 md:w-auto"
              >
                <h2
                  id={headingId}
                  className="flex items-center justify-between px-1 text-sm font-semibold"
                >
                  {STATUS_LABELS[status]}
                  <span className="text-xs font-normal text-muted">
                    {cards.length}
                  </span>
                </h2>
                {cards.map((application) => (
                  <ApplicationCard
                    key={application.id}
                    application={application}
                    onStatusChange={(s) =>
                      handleStatusChange(application.id, s)
                    }
                    onUpdate={(data) => handleUpdate(application.id, data)}
                    onDelete={() => handleDelete(application)}
                  />
                ))}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
