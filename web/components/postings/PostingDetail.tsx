"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ApiError, getPosting, type Posting } from "@/lib/api";
import { safeHref } from "@/lib/url";

import { FitPanel } from "../fit/FitPanel";
import { buttonClass } from "../ui/Button";
import { DocumentIcon, ExternalIcon } from "../ui/Icons";
import { PageHeader } from "../ui/PageHeader";
import { EmptyState, ErrorBanner, Loading, Skeleton } from "../ui/States";

type State =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "error"; message: string }
  | { kind: "ready"; posting: Posting };

function BackLink() {
  return (
    <Link
      href="/postings"
      className="mb-4 inline-block text-sm text-muted hover:text-pine"
    >
      ← All postings
    </Link>
  );
}

/** One posting: its fit score next to the ad itself. */
export function PostingDetail({ id }: { id: number }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    getPosting(id)
      .then((posting) => !cancelled && setState({ kind: "ready", posting }))
      .catch((e: unknown) => {
        if (cancelled) return;
        // Someone else's posting is a 404 too: it looks exactly like a missing one.
        if (e instanceof ApiError && e.status === 404) {
          setState({ kind: "missing" });
        } else {
          setState({
            kind: "error",
            message: e instanceof Error ? e.message : "Something went wrong",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (state.kind === "loading") {
    return (
      <Loading label="Loading the posting…" className="grid gap-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </Loading>
    );
  }
  if (state.kind === "missing") {
    return (
      <>
        <BackLink />
        <EmptyState
          icon={<DocumentIcon width={28} height={28} />}
          title="Posting not found"
        >
          It may have been deleted.
        </EmptyState>
      </>
    );
  }
  if (state.kind === "error") {
    return (
      <>
        <BackLink />
        <ErrorBanner>{state.message}</ErrorBanner>
      </>
    );
  }

  const { posting } = state;
  const href = safeHref(posting.url);
  return (
    <>
      <BackLink />
      <PageHeader
        title={posting.title}
        description={
          <>
            {posting.company}
            {posting.location && <> · {posting.location}</>}
          </>
        }
        actions={
          href && (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClass("secondary", "md")}
            >
              <ExternalIcon width={14} height={14} />
              Open the ad
            </a>
          )
        }
      />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <FitPanel postingId={posting.id} />
        <section
          aria-labelledby="description-heading"
          className="rounded-lg border border-line bg-surface p-5 shadow-xs"
        >
          <h2 id="description-heading" className="mb-3 text-base font-semibold">
            Job description
          </h2>
          <p className="max-h-[32rem] overflow-y-auto text-sm leading-relaxed whitespace-pre-line text-pine/90">
            {posting.description}
          </p>
        </section>
      </div>
    </>
  );
}
