import { render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { expect, test, vi } from "vitest";

import { AppHeader } from "./AppHeader";

vi.mock("next/navigation", () => ({ usePathname: vi.fn() }));
vi.mock("@/lib/auth/client", () => ({
  authClient: {
    useSession: () => ({ data: { user: { email: "ada@example.com" } } }),
    signOut: vi.fn(),
  },
}));

test("links to every page and marks the current one", () => {
  vi.mocked(usePathname).mockReturnValue("/cv");
  render(<AppHeader />);

  const nav = screen.getByRole("navigation", { name: "Main" });
  const board = screen.getByRole("link", { name: "Board" });
  const cv = screen.getByRole("link", { name: "CV" });

  expect(nav.contains(cv)).toBe(true);
  expect(board.getAttribute("href")).toBe("/");
  expect(cv.getAttribute("href")).toBe("/cv");
  expect(cv.getAttribute("aria-current")).toBe("page");
  expect(board.getAttribute("aria-current")).toBeNull();
});
