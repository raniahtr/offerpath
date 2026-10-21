import type { ReactNode } from "react";

import { cx } from "@/lib/cx";

/** Shared look of text inputs, selects and textareas. */
export const controlClass =
  "block w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-pine placeholder:text-muted/70 transition-colors hover:border-muted/50 focus-visible:border-sage disabled:opacity-60";

interface FieldProps {
  label: ReactNode;
  /** The input, select or textarea; the <label> wraps it, so it gets the label's name. */
  children: ReactNode;
  hint?: ReactNode;
  className?: string;
}

export function Field({ label, children, hint, className }: FieldProps) {
  return (
    <label
      className={cx("grid gap-1.5 text-xs font-medium text-muted", className)}
    >
      {label}
      {children}
      {hint && <span className="font-normal text-muted">{hint}</span>}
    </label>
  );
}
