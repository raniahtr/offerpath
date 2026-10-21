import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { listApplications } from "@/lib/api";

import Home from "./page";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  listApplications: vi.fn(),
}));

// The shared header (brand, nav, user menu) lives in the (app) layout and has its own test.
test("renders the page title and the board", async () => {
  vi.mocked(listApplications).mockResolvedValue([]);
  render(<Home />);

  expect(
    screen.getByRole("heading", { level: 1, name: "Applications" }),
  ).toBeDefined();
  expect(await screen.findByRole("region", { name: /^Saved/ })).toBeDefined();
});
