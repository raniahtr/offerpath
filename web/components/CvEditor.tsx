"use client";

import { type ChangeEvent, type FormEvent, useEffect, useState } from "react";

import {
  type Cv,
  type CvFormat,
  deleteCv,
  extractPdfText,
  getCv,
  saveCv,
} from "@/lib/api";

// Same limit as the API (CV_MAX_CHARS in api/app/schemas/cv.py).
const MAX_CHARS = 50_000;

const FORMAT_LABELS: Record<CvFormat, string> = {
  latex: "LaTeX",
  text: "Plain text",
  pdf: "Text from a PDF",
};

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

function formatSavedAt(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CvEditor() {
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState<Cv | null>(null);
  const [content, setContent] = useState("");
  const [format, setFormat] = useState<CvFormat>("latex");
  const [busy, setBusy] = useState<"saving" | "importing" | "deleting" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCv()
      .then((cv) => {
        if (cancelled) return;
        setSaved(cv);
        setContent(cv?.content ?? "");
        setFormat(cv?.format ?? "latex");
        setLoaded(true);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(errorText(e));
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const unchanged =
    saved !== null && saved.content === content && saved.format === format;

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("saving");
    setError(null);
    setNotice(null);
    try {
      const cv = await saveCv(content, format);
      setSaved(cv);
      setContent(cv.content); // the API trims surrounding whitespace
      setNotice("Saved");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  async function handlePdf(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = ""; // picking the same file again should trigger another import
    if (!file) return;
    if (
      content.trim() &&
      !window.confirm("Replace the text below with the text of this PDF?")
    ) {
      return;
    }
    setBusy("importing");
    setError(null);
    setNotice(null);
    try {
      const { text, pages } = await extractPdfText(file);
      setContent(text);
      setFormat("pdf");
      setNotice(
        `Imported ${pages} page${pages === 1 ? "" : "s"}. Check the text, then save.`,
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete your saved CV? This can't be undone.")) return;
    setBusy("deleting");
    setError(null);
    setNotice(null);
    try {
      await deleteCv();
      setSaved(null);
      setContent("");
      setFormat("latex");
      setNotice("CV deleted");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  if (!loaded) {
    return <p className="text-sm text-muted">Loading your CV…</p>;
  }

  return (
    <form onSubmit={handleSave} aria-label="Your CV" className="grid gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="text-xs text-muted">
          Format
          <select
            value={format}
            onChange={(e) => setFormat(e.currentTarget.value as CvFormat)}
            className="mt-1 block rounded-md border border-line bg-surface px-3 py-2 text-sm"
          >
            {(Object.keys(FORMAT_LABELS) as CvFormat[]).map((value) => (
              <option key={value} value={value}>
                {FORMAT_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="cursor-pointer rounded-md border border-line px-3 py-2 text-sm hover:bg-sage-soft">
          {busy === "importing" ? "Reading PDF…" : "Import from PDF"}
          <input
            type="file"
            accept="application/pdf"
            onChange={handlePdf}
            disabled={busy !== null}
            className="sr-only"
          />
        </label>
      </div>

      <label className="text-xs text-muted">
        CV content (for LaTeX, paste your Overleaf source)
        <textarea
          value={content}
          onChange={(e) => setContent(e.currentTarget.value)}
          required
          maxLength={MAX_CHARS}
          rows={22}
          spellCheck={false}
          className="mt-1 block w-full rounded-md border border-line bg-surface px-3 py-2 font-mono text-xs"
        />
      </label>
      <p className="text-xs text-muted">
        {content.length.toLocaleString("en-US")} /{" "}
        {MAX_CHARS.toLocaleString("en-US")} characters
        {saved && <> · Last saved {formatSavedAt(saved.updated_at)}</>}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy !== null || unchanged}
          className="rounded-md bg-sage px-4 py-2 text-sm font-medium text-white hover:bg-sage-dark disabled:opacity-60"
        >
          {busy === "saving" ? "Saving…" : "Save CV"}
        </button>
        {saved && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy !== null}
            className="rounded-md border border-line px-4 py-2 text-sm hover:bg-amber-soft disabled:opacity-60"
          >
            {busy === "deleting" ? "Deleting…" : "Delete CV"}
          </button>
        )}
        {notice && (
          <p role="status" className="text-sm text-sage">
            {notice}
          </p>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-amber">
          {error}
        </p>
      )}
      <p className="text-xs text-muted">
        Only you can see your CV. It is sent to the AI provider only when you
        ask for an analysis, and an imported PDF file is never stored.
      </p>
    </form>
  );
}
