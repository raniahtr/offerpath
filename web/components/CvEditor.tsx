"use client";

import type { ChangeEvent, FormEvent } from "react";

import type { CvFormat } from "@/lib/api";
import { cx } from "@/lib/cx";

import { Button, buttonClass } from "./ui/Button";
import { controlClass, Field } from "./ui/Field";
import { UploadIcon } from "./ui/Icons";
import { ErrorBanner, Loading, Skeleton } from "./ui/States";
import { useCvEditor } from "./useCvEditor";

// Same limit as the API (CV_MAX_CHARS in api/app/schemas/cv.py).
const MAX_CHARS = 50_000;

const FORMAT_LABELS: Record<CvFormat, string> = {
  latex: "LaTeX",
  text: "Plain text",
  pdf: "Text from a PDF",
};

function formatSavedAt(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const panelClass = "rounded-lg border border-line bg-surface shadow-xs";

export function CvEditor() {
  const cv = useCvEditor();

  if (!cv.loaded) {
    return (
      <Loading
        label="Loading your CV…"
        className="grid gap-4 lg:grid-cols-[1fr_18rem]"
      >
        <Skeleton className="h-[32rem] rounded-lg" />
        <Skeleton className="h-56 rounded-lg" />
      </Loading>
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void cv.save();
  }

  function handlePdf(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = ""; // picking the same file again should trigger another import
    if (file) void cv.importPdf(file);
  }

  const used = cv.content.length / MAX_CHARS;
  const idle = cv.busy === null;

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Your CV"
      className="grid items-start gap-4 lg:grid-cols-[1fr_18rem]"
    >
      <section className={panelClass} aria-label="CV source">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-3 py-2">
          <label className="flex items-center gap-2 text-xs font-medium text-muted">
            Format
            <select
              value={cv.format}
              onChange={(e) => cv.setFormat(e.currentTarget.value as CvFormat)}
              className={cx(controlClass, "h-8 w-auto py-1 text-xs")}
            >
              {(Object.keys(FORMAT_LABELS) as CvFormat[]).map((value) => (
                <option key={value} value={value}>
                  {FORMAT_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          <label
            className={buttonClass(
              "secondary",
              "sm",
              cx("cursor-pointer", !idle && "opacity-50"),
            )}
          >
            <UploadIcon width={14} height={14} />
            {cv.busy === "importing" ? "Reading PDF…" : "Import from PDF"}
            <input
              type="file"
              accept="application/pdf"
              onChange={handlePdf}
              disabled={!idle}
              className="sr-only"
            />
          </label>
        </div>
        <label className="block">
          <span className="sr-only">
            CV content (for LaTeX, paste your Overleaf source)
          </span>
          <textarea
            value={cv.content}
            onChange={(e) => cv.setContent(e.currentTarget.value)}
            required
            maxLength={MAX_CHARS}
            rows={26}
            spellCheck={false}
            placeholder={"\\documentclass{article}\n\\begin{document}\n…"}
            className="block w-full resize-y rounded-b-lg bg-surface px-4 py-3 font-mono text-xs leading-relaxed text-pine placeholder:text-muted/60 focus-visible:outline-offset-0"
          />
        </label>
      </section>

      <aside className="grid gap-4 lg:sticky lg:top-20">
        <div className={cx(panelClass, "grid gap-4 p-4")}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Status</h2>
            <SaveState saved={cv.saved !== null} dirty={cv.dirty} />
          </div>
          {cv.saved && (
            <p className="text-xs text-muted">
              Last saved {formatSavedAt(cv.saved.updated_at)}
            </p>
          )}

          <Field
            label="Length"
            hint={`${cv.content.length.toLocaleString("en-US")} / ${MAX_CHARS.toLocaleString("en-US")} characters`}
          >
            <span
              aria-hidden="true"
              className="block h-1.5 overflow-hidden rounded-full bg-mist"
            >
              <span
                className={cx(
                  "block h-full rounded-full",
                  used > 0.9 ? "bg-amber" : "bg-sage",
                )}
                style={{ width: `${Math.min(used, 1) * 100}%` }}
              />
            </span>
          </Field>

          <div className="grid gap-2">
            <Button
              type="submit"
              variant="primary"
              disabled={!idle || !cv.dirty}
            >
              {cv.busy === "saving" ? "Saving…" : "Save CV"}
            </Button>
            {cv.saved && (
              <Button variant="danger" onClick={cv.remove} disabled={!idle}>
                {cv.busy === "deleting" ? "Deleting…" : "Delete CV"}
              </Button>
            )}
          </div>

          {cv.notice && (
            <p role="status" className="text-sm text-sage">
              {cv.notice}
            </p>
          )}
          {cv.error && <ErrorBanner>{cv.error}</ErrorBanner>}
        </div>

        <p className="px-1 text-xs leading-relaxed text-muted">
          Only you can see your CV. It is sent to the AI provider only when you
          ask for an analysis, and an imported PDF file is never stored.
        </p>
      </aside>
    </form>
  );
}

function SaveState({ saved, dirty }: { saved: boolean; dirty: boolean }) {
  const [label, tone] = dirty
    ? ["Unsaved changes", "bg-amber-soft text-amber"]
    : saved
      ? ["Saved", "bg-sage-soft text-sage-dark"]
      : ["Not saved yet", "bg-mist text-muted"];
  return (
    <span className={cx("rounded-full px-2 py-0.5 text-xs font-medium", tone)}>
      {label}
    </span>
  );
}
