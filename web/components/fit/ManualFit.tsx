"use client";

import { type FormEvent, useState } from "react";

import { type FitAnalysis, getFitPrompt, saveManualFit } from "@/lib/api";

import { Button } from "../ui/Button";
import { controlClass, Field } from "../ui/Field";
import { ErrorBanner } from "../ui/States";

interface ManualFitProps {
  postingId: number;
  onSaved: (fit: FitAnalysis) => void;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

/** Free mode without the app's AI: copy the prompt to your own chat, paste its answer back.
 * The answer is checked against the same schema as in-app analyses. */
export function ManualFit({ postingId, onSaved }: ManualFitProps) {
  const [prompt, setPrompt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState<"copying" | "saving" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function copyPrompt() {
    setBusy("copying");
    setError(null);
    try {
      const text = prompt ?? (await getFitPrompt(postingId));
      setPrompt(text);
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
      } catch {
        // Clipboard blocked (permissions, older browser): the prompt is shown to copy by hand.
        setCopied(false);
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("saving");
    setError(null);
    try {
      onSaved(await saveManualFit(postingId, answer));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Use your own chat"
      className="grid gap-4 rounded-lg border border-line bg-mist/40 p-4"
    >
      <ol className="grid gap-4 text-sm">
        <li className="grid gap-2">
          <p>
            <span className="font-semibold">1.</span> Copy the prompt and paste
            it into ChatGPT, Claude or any chat you use.
          </p>
          <div className="flex items-center gap-3">
            <Button size="sm" onClick={copyPrompt} disabled={busy !== null}>
              {busy === "copying" ? "Preparing…" : "Copy prompt"}
            </Button>
            {copied && (
              <span role="status" className="text-xs text-sage">
                Copied to your clipboard
              </span>
            )}
          </div>
          {prompt && !copied && (
            <Field label="Prompt (select all and copy)">
              <textarea
                readOnly
                value={prompt}
                rows={6}
                className={controlClass + " font-mono text-xs"}
              />
            </Field>
          )}
        </li>
        <li className="grid gap-2">
          <p>
            <span className="font-semibold">2.</span> Paste the chat&apos;s
            whole answer here. It is checked before it is saved.
          </p>
          <Field label="Answer from your chat">
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.currentTarget.value)}
              required
              maxLength={20_000}
              rows={6}
              className={controlClass + " font-mono text-xs"}
            />
          </Field>
        </li>
      </ol>
      {error && <ErrorBanner>{error}</ErrorBanner>}
      <div className="flex justify-end">
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={busy !== null || !answer.trim()}
        >
          {busy === "saving" ? "Checking…" : "Check and save"}
        </Button>
      </div>
    </form>
  );
}
