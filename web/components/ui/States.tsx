import type { ReactNode } from "react";

import { cx } from "@/lib/cx";

/** A grey placeholder block while content loads. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cx("animate-pulse rounded-md bg-line/60", className)}
    />
  );
}

/** Wraps skeletons so screen readers hear `label` instead of nothing. */
export function Loading({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div aria-busy="true" className={className}>
      <span className="sr-only" role="status">
        {label}
      </span>
      {children}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-line px-6 py-10 text-center">
      {icon && <div className="mb-3 text-muted">{icon}</div>}
      <h2 className="text-sm font-semibold">{title}</h2>
      {children && (
        <p className="mt-1 max-w-sm text-sm text-muted">{children}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** An inline error banner (role="alert" so it is announced as soon as it appears). */
export function ErrorBanner({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-md border border-rose/20 bg-rose-soft px-3 py-2 text-sm text-rose"
    >
      {children}
    </p>
  );
}
