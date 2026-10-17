/** "2026-11-30" -> "Nov 30". Parsed as a local date: `new Date("2026-11-30")` would be
 * UTC midnight, which shows as the previous day in timezones west of UTC. */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
