import type { FitAnalysis } from "@/lib/api";
import { cx } from "@/lib/cx";

// Same bands as the prompt the AI follows (api/app/services/fit.py).
function band(score: number): { label: string; text: string; bar: string } {
  if (score >= 80)
    return { label: "Strong fit", text: "text-sage-dark", bar: "bg-sage" };
  if (score >= 50)
    return { label: "Partial fit", text: "text-amber", bar: "bg-amber" };
  return { label: "Weak fit", text: "text-rose", bar: "bg-rose" };
}

function analysedOn(fit: FitAnalysis): string {
  const when = new Date(fit.created_at).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const how =
    fit.source === "manual"
      ? "your own chat"
      : `AI (${fit.model ?? "unknown"})`;
  return `Analysed ${when} with ${how}`;
}

function SkillList({
  title,
  skills,
  empty,
  tone,
}: {
  title: string;
  skills: string[];
  empty: string;
  tone: "match" | "gap";
}) {
  return (
    <section aria-label={title}>
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">
        {title}
      </h3>
      {skills.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {skills.map((skill) => (
            <li
              key={skill}
              className={cx(
                "rounded-md px-2 py-1 text-xs font-medium",
                tone === "match"
                  ? "bg-sage-soft text-sage-dark"
                  : "bg-amber-soft text-amber",
              )}
            >
              {skill}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function FitResult({ fit }: { fit: FitAnalysis }) {
  const { label, text, bar } = band(fit.score);
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <p className="flex items-baseline gap-1">
          <span className={cx("text-4xl font-semibold tabular-nums", text)}>
            {fit.score}
          </span>
          <span className="text-sm text-muted">/ 100</span>
        </p>
        <p className={cx("pb-1 text-sm font-semibold", text)}>{label}</p>
      </div>
      <div
        role="meter"
        aria-label="Fit score"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={fit.score}
        aria-valuetext={`${fit.score} out of 100, ${label.toLowerCase()}`}
        className="-mt-3 h-2 overflow-hidden rounded-full bg-mist"
      >
        <div
          className={cx("h-full rounded-full", bar)}
          style={{ width: `${fit.score}%` }}
        />
      </div>

      <p className="text-sm leading-relaxed">{fit.explanation}</p>

      <div className="grid gap-5 sm:grid-cols-2">
        <SkillList
          title="What matches"
          skills={fit.matched_skills}
          empty="No clear matches found."
          tone="match"
        />
        <SkillList
          title="What's missing"
          skills={fit.missing_skills}
          empty="Nothing important is missing."
          tone="gap"
        />
      </div>

      <p className="text-xs text-muted">{analysedOn(fit)}</p>
    </div>
  );
}
