"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  analyzeFit,
  ApiError,
  type FitAnalysis,
  getLatestFit,
} from "@/lib/api";

import { Button } from "../ui/Button";
import { ErrorBanner, Loading, Skeleton } from "../ui/States";
import { FitResult } from "./FitResult";
import { ManualFit } from "./ManualFit";

interface Problem {
  message: string;
  status: number;
}

function toProblem(error: unknown): Problem {
  return error instanceof ApiError
    ? { message: error.message, status: error.status }
    : { message: "Something went wrong", status: 0 };
}

/** The fit score for one posting: latest result, run the AI, or use your own chat. */
export function FitPanel({ postingId }: { postingId: number }) {
  // undefined = still loading, null = never analysed.
  const [fit, setFit] = useState<FitAnalysis | null | undefined>(undefined);
  const [running, setRunning] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [manual, setManual] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getLatestFit(postingId)
      .then((latest) => !cancelled && setFit(latest))
      .catch((e: unknown) => {
        if (cancelled) return;
        setFit(null);
        setProblem(toProblem(e));
      });
    return () => {
      cancelled = true;
    };
  }, [postingId]);

  async function runAnalysis() {
    setRunning(true);
    setProblem(null);
    try {
      setFit(await analyzeFit(postingId));
      setManual(false);
    } catch (e) {
      setProblem(toProblem(e));
    } finally {
      setRunning(false);
    }
  }

  function handleManualSaved(saved: FitAnalysis) {
    setFit(saved);
    setManual(false);
    setProblem(null);
  }

  // No CV (409): nothing to compare yet. Limit or AI down (429/503): the free mode still works.
  const needsCv = problem?.status === 409;
  const aiBlocked = problem?.status === 429 || problem?.status === 503;

  return (
    <section
      aria-labelledby="fit-heading"
      className="grid gap-5 rounded-lg border border-line bg-surface p-5 shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="fit-heading" className="text-base font-semibold">
            CV fit
          </h2>
          <p className="text-sm text-muted">
            How well your saved CV matches this posting.
          </p>
        </div>
        {fit !== undefined && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setManual((open) => !open)}
              aria-expanded={manual}
            >
              {manual ? "Hide own-chat mode" : "Use my own chat"}
            </Button>
            <Button
              size="sm"
              variant={fit ? "secondary" : "primary"}
              onClick={runAnalysis}
              disabled={running}
            >
              {running
                ? "Analysing…"
                : fit
                  ? "Analyse again"
                  : "Analyse with AI"}
            </Button>
          </div>
        )}
      </div>

      {problem && (
        <ErrorBanner>
          {problem.message}
          {needsCv && (
            <>
              {" "}
              <Link href="/cv" className="font-medium underline">
                Go to your CV
              </Link>
            </>
          )}
          {aiBlocked && !manual && (
            <>
              {" "}
              <button
                type="button"
                onClick={() => setManual(true)}
                className="font-medium underline"
              >
                Use your own chat instead
              </button>{" "}
              (free, no limit).
            </>
          )}
        </ErrorBanner>
      )}

      {running && (
        <p role="status" className="text-sm text-muted">
          Comparing your CV with the posting. This takes a few seconds…
        </p>
      )}

      {manual && (
        <ManualFit postingId={postingId} onSaved={handleManualSaved} />
      )}

      {fit === undefined ? (
        <Loading label="Loading the fit score…" className="grid gap-3">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-16 w-full" />
        </Loading>
      ) : fit ? (
        <FitResult fit={fit} />
      ) : (
        !running &&
        !manual && (
          <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
            Not analysed yet. The AI compares the posting&apos;s requirements
            with{" "}
            <Link href="/cv" className="underline hover:text-pine">
              your CV
            </Link>{" "}
            and explains the gaps (one request from your daily AI limit). Your
            own chat works too, for free.
          </p>
        )
      )}
    </section>
  );
}
