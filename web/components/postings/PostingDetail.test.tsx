import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { ApiError, getLatestFit, getPosting } from "@/lib/api";

import { PostingDetail } from "./PostingDetail";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getPosting: vi.fn(),
  getLatestFit: vi.fn(),
}));

test("shows the posting, its link and the fit panel", async () => {
  vi.mocked(getPosting).mockResolvedValue({
    id: 7,
    title: "ML Engineering Intern",
    company: "Globex",
    location: "Zurich",
    url: "https://jobs.example.com/7",
    description: "We need Python, PyTorch and Kubernetes.",
    created_at: "2026-10-21T10:00:00Z",
  });
  vi.mocked(getLatestFit).mockResolvedValue(null);
  render(<PostingDetail id={7} />);

  expect(
    await screen.findByRole("heading", {
      level: 1,
      name: "ML Engineering Intern",
    }),
  ).toBeDefined();
  expect(screen.getByText("Globex · Zurich")).toBeDefined();
  expect(screen.getByText(/We need Python/)).toBeDefined();
  expect(
    screen.getByRole("link", { name: "Open the ad" }).getAttribute("href"),
  ).toBe("https://jobs.example.com/7");
  expect(screen.getByRole("region", { name: "CV fit" })).toBeDefined();
});

test("a missing (or someone else's) posting shows 'not found'", async () => {
  vi.mocked(getPosting).mockRejectedValue(
    new ApiError("Posting not found", 404),
  );
  render(<PostingDetail id={99} />);

  expect(await screen.findByText("Posting not found")).toBeDefined();
  expect(screen.getByRole("link", { name: "← All postings" })).toBeDefined();
});
