import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import Home from "./page";

// Smoke test: proves the test setup (jsdom, JSX, imports) works end to end.
test("renders the app heading", () => {
  render(<Home />);
  expect(
    screen.getByRole("heading", { level: 1, name: "Offerpath" }),
  ).toBeDefined();
});
