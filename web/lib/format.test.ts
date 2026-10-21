import { describe, expect, test } from "vitest";

import { deadlineStatus, formatDate } from "./format";

const today = new Date(2026, 9, 21, 15, 30); // Oct 21, mid-afternoon

describe("deadlineStatus", () => {
  test.each([
    ["2026-10-20", "Overdue · Oct 20", "overdue"],
    ["2026-10-21", "Due today", "soon"],
    ["2026-10-28", "Due Oct 28", "soon"],
    ["2026-10-29", "Due Oct 29", "later"],
  ])("%s -> %s (%s)", (iso, label, tone) => {
    expect(deadlineStatus(iso, today)).toEqual({ label, tone });
  });
});

test("formatDate reads the date in local time", () => {
  expect(formatDate("2026-11-30")).toBe("Nov 30");
});
