import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";

import { authClient } from "@/lib/auth/client";
import { redirectToSignIn } from "@/lib/auth/session";

import { UserMenu } from "./UserMenu";

vi.mock("@/lib/auth/client", () => ({
  authClient: { useSession: vi.fn(), signOut: vi.fn() },
}));
vi.mock("@/lib/auth/session", () => ({ redirectToSignIn: vi.fn() }));

function signedInAs(email: string) {
  vi.mocked(authClient.useSession).mockReturnValue({
    data: { user: { email } },
  } as never);
}

test("shows who is signed in", () => {
  signedInAs("ada@example.com");
  render(<UserMenu />);

  expect(screen.getByText("ada@example.com")).toBeDefined();
});

test("sign out ends the session, then goes to the sign-in page", async () => {
  signedInAs("ada@example.com");
  const order: string[] = [];
  vi.mocked(authClient.signOut).mockImplementation(async () => {
    order.push("signOut");
    return { data: null, error: null } as never;
  });
  vi.mocked(redirectToSignIn).mockImplementation(() => {
    order.push("redirect");
  });
  render(<UserMenu />);

  await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
  expect(order).toEqual(["signOut", "redirect"]);
});
