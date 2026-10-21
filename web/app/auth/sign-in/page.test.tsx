import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";

import { authClient } from "@/lib/auth/client";

import SignInPage from "./page";

vi.mock("@/lib/auth/client", () => ({
  authClient: { signIn: { social: vi.fn() } },
}));

const social = vi.mocked(authClient.signIn.social);

test.each([
  ["Google", "google"],
  ["GitHub", "github"],
])(
  "Continue with %s starts that provider's login and returns to the board",
  async (label, provider) => {
    social.mockResolvedValue({ data: null, error: null } as never);
    render(<SignInPage />);

    await userEvent.click(
      screen.getByRole("button", { name: `Continue with ${label}` }),
    );
    expect(social).toHaveBeenCalledWith({
      provider,
      callbackURL: `${window.location.origin}/`,
    });
  },
);

test("only social sign-in is offered: no password field", () => {
  render(<SignInPage />);

  expect(screen.getAllByRole("button")).toHaveLength(2);
  expect(screen.queryByLabelText(/password/i)).toBeNull();
});

test("a failed sign-in shows the error and re-enables the buttons", async () => {
  social.mockResolvedValue({
    data: null,
    error: { message: "Provider not enabled" },
  } as never);
  render(<SignInPage />);

  await userEvent.click(
    screen.getByRole("button", { name: "Continue with GitHub" }),
  );
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Provider not enabled",
  );
  expect(
    screen
      .getAllByRole("button")
      .every((b) => !(b as HTMLButtonElement).disabled),
  ).toBe(true);
});
