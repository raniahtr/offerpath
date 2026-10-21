"use client";

import { useEffect, useState } from "react";

import {
  type Cv,
  type CvFormat,
  deleteCv,
  extractPdfText,
  getCv,
  saveCv,
} from "@/lib/api";

export type CvBusy = "saving" | "importing" | "deleting" | null;

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

/** Data and actions behind the CV page; CvEditor only renders them. */
export function useCvEditor() {
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState<Cv | null>(null);
  const [content, setContent] = useState("");
  const [format, setFormat] = useState<CvFormat>("latex");
  const [busy, setBusy] = useState<CvBusy>(null);
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
      })
      .catch((e: unknown) => !cancelled && setError(errorText(e)))
      .finally(() => !cancelled && setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = saved
    ? saved.content !== content || saved.format !== format
    : content.trim() !== "";

  // Leaving with unsaved edits: let the browser ask "Leave site?" first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function run(kind: Exclude<CvBusy, null>, action: () => Promise<void>) {
    setBusy(kind);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  const save = () =>
    run("saving", async () => {
      const cv = await saveCv(content, format);
      setSaved(cv);
      setContent(cv.content); // the API trims surrounding whitespace
      setNotice("Saved");
    });

  async function importPdf(file: File) {
    if (
      content.trim() &&
      !window.confirm("Replace the text below with the text of this PDF?")
    ) {
      return;
    }
    await run("importing", async () => {
      const { text, pages } = await extractPdfText(file);
      setContent(text);
      setFormat("pdf");
      setNotice(
        `Imported ${pages} page${pages === 1 ? "" : "s"}. Check the text, then save.`,
      );
    });
  }

  async function remove() {
    if (!window.confirm("Delete your saved CV? This can't be undone.")) return;
    await run("deleting", async () => {
      await deleteCv();
      setSaved(null);
      setContent("");
      setFormat("latex");
      setNotice("CV deleted");
    });
  }

  return {
    loaded,
    saved,
    content,
    setContent,
    format,
    setFormat,
    busy,
    error,
    notice,
    dirty,
    save,
    importPdf,
    remove,
  };
}
