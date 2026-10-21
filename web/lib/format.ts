/** "2026-11-30" -> "Nov 30". Parsed as a local date: `new Date("2026-11-30")` would be
 * UTC midnight, which shows as the previous day in timezones west of UTC. */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export type DeadlineTone = "overdue" | "soon" | "later";

/** How urgent a deadline is, worded for a card: "Overdue · Nov 3", "Due today",
 * "Due Nov 30". Within a week counts as soon. `today` is a parameter so tests can fix it. */
export function deadlineStatus(
  isoDate: string,
  today: Date = new Date(),
): { label: string; tone: DeadlineTone } {
  const [year, month, day] = isoDate.split("-").map(Number);
  const due = new Date(year, month - 1, day);
  const start = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const days = Math.round((due.getTime() - start.getTime()) / 86_400_000);
  if (days < 0)
    return { label: `Overdue · ${formatDate(isoDate)}`, tone: "overdue" };
  if (days === 0) return { label: "Due today", tone: "soon" };
  return {
    label: `Due ${formatDate(isoDate)}`,
    tone: days <= 7 ? "soon" : "later",
  };
}
