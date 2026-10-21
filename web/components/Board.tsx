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

import { cx } from "@/lib/cx";

import { ApplicationCard } from "./ApplicationCard";
import { NewApplicationForm } from "./NewApplicationForm";
import { STATUS_DOTS, STATUS_LABELS } from "./statusLabels";
import { ErrorBanner, Loading, Skeleton } from "./ui/States";

const columnsClass =
  "-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-5 md:overflow-visible md:px-0";
const columnClass =
  "flex w-[85%] shrink-0 snap-start flex-col gap-2 rounded-xl bg-sage-soft/40 p-2 md:w-auto";

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

function BoardSkeleton() {
  return (
    <Loading label="Loading applications…" className={columnsClass}>
      {APPLICATION_STATUSES.map((status, index) => (
        <div key={status} className={columnClass}>
          <Skeleton className="h-5 w-24" />
          {Array.from({ length: index % 2 === 0 ? 2 : 1 }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ))}
    </Loading>
  );
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
    <div className="flex flex-col gap-5">
      <NewApplicationForm onCreate={handleCreate} />

      {error && <ErrorBanner>{error}</ErrorBanner>}

      {applications === null ? (
        !error && <BoardSkeleton />
      ) : (
        // Phones: one column per screen, swipe sideways (snap). md and up: all five side by side.
        <div className={columnsClass}>
          {APPLICATION_STATUSES.map((status) => {
            const cards = applications.filter((a) => a.status === status);
            const headingId = `column-${status}`;
            return (
              <section
                key={status}
                aria-labelledby={headingId}
                className={columnClass}
              >
                <h2
                  id={headingId}
                  className="flex items-center gap-2 px-1 py-0.5 text-xs font-semibold tracking-wide text-muted uppercase"
                >
                  <span
                    aria-hidden="true"
                    className={cx("size-2 rounded-full", STATUS_DOTS[status])}
                  />
                  {STATUS_LABELS[status]}
                  <span className="ml-auto rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-muted tabular-nums">
                    {cards.length}
                  </span>
                </h2>
                {cards.length === 0 && (
                  <p className="hidden rounded-lg border border-dashed border-line px-3 py-6 text-center text-xs text-muted md:block">
                    Nothing here yet
                  </p>
                )}
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
