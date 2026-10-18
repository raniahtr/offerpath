import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { listApplications } from "@/lib/api";

import Home from "./page";

// The header's user menu reads the session from Neon Auth; stub it as signed in.
vi.mock("@/lib/auth/client", () => ({
  authClient: {
    useSession: () => ({ data: { user: { email: "ada@example.com" } } }),
    signOut: vi.fn(),
  },
}));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  listApplications: vi.fn(),
}));

test("renders the heading, the user menu and the board", async () => {
  vi.mocked(listApplications).mockResolvedValue([]);
  render(<Home />);

  expect(
    screen.getByRole("heading", { level: 1, name: "Offerpath" }),
  ).toBeDefined();
  expect(screen.getByRole("button", { name: "Sign out" })).toBeDefined();
  expect(await screen.findByRole("region", { name: /^Saved/ })).toBeDefined();
});
