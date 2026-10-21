import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

import {
  ApiError,
  type Application,
  createApplication,
  deleteApplication,
  listApplications,
  updateApplication,
} from "@/lib/api";

import { Board } from "./Board";

// Replace only the network functions; keep the real types, ApiError and status list.
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  listApplications: vi.fn(),
  createApplication: vi.fn(),
  updateApplication: vi.fn(),
  deleteApplication: vi.fn(),
}));

function makeApplication(overrides: Partial<Application>): Application {
  return {
    id: 1,
    company: "Acme",
    role: "ML intern",
    url: null,
    status: "saved",
    applied_at: null,
    deadline: null,
    notes: null,
    cv_version: null,
    created_at: "2026-10-17T10:00:00Z",
    updated_at: "2026-10-17T10:00:00Z",
    ...overrides,
  };
}

const acme = makeApplication({ id: 1, company: "Acme", status: "saved" });
const globex = makeApplication({
  id: 2,
  company: "Globex",
  role: "Data intern",
  status: "interview",
  deadline: "2026-11-30",
});

function column(name: string): HTMLElement {
  return screen.getByRole("region", { name: new RegExp(`^${name}`) });
}

async function renderBoard(applications: Application[] = [acme, globex]) {
  vi.mocked(listApplications).mockResolvedValue(applications);
  render(<Board />);
  // Wait for the initial load to finish (cards are rendered after the API answers).
  await screen.findByRole("region", { name: /^Saved/ });
}

// Deadline labels depend on today's date: fix it (only Date, so userEvent's timers still run).
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 21));
  return () => vi.useRealTimers();
});

beforeEach(() => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

describe("loading", () => {
  test("puts each application in the column of its status", async () => {
    await renderBoard();

    expect(within(column("Saved")).getByText("Acme")).toBeDefined();
    expect(within(column("Interview")).getByText("Globex")).toBeDefined();
    expect(within(column("Interview")).getByText("Due Nov 30")).toBeDefined();
    expect(within(column("Applied")).queryAllByRole("article")).toHaveLength(0);
  });

  test("shows the error when the API cannot be reached", async () => {
    vi.mocked(listApplications).mockRejectedValue(
      new ApiError("Could not reach the API. Is it running?", 0),
    );
    render(<Board />);

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Could not reach the API. Is it running?",
    );
    expect(screen.queryByText("Loading applications…")).toBeNull();
  });
});

describe("moving a card", () => {
  test("changing the status moves the card and saves it", async () => {
    vi.mocked(updateApplication).mockResolvedValue({
      ...acme,
      status: "applied",
    });
    await renderBoard();

    await userEvent.selectOptions(
      screen.getByLabelText("Status for Acme, ML intern"),
      "applied",
    );

    expect(within(column("Applied")).getByText("Acme")).toBeDefined();
    expect(within(column("Saved")).queryByText("Acme")).toBeNull();
    expect(updateApplication).toHaveBeenCalledWith(1, { status: "applied" });
  });

  test("a failed save puts the card back and explains why", async () => {
    vi.mocked(updateApplication).mockRejectedValue(
      new ApiError("Application not found", 404),
    );
    await renderBoard();

    await userEvent.selectOptions(
      screen.getByLabelText("Status for Acme, ML intern"),
      "offer",
    );

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Could not move the card: Application not found",
    );
    expect(within(column("Saved")).getByText("Acme")).toBeDefined();
    expect(within(column("Offer")).queryByText("Acme")).toBeNull();
  });
});

describe("adding an application", () => {
  test("the new card appears in Saved", async () => {
    vi.mocked(createApplication).mockResolvedValue(
      makeApplication({ id: 3, company: "Initech", role: "SWE intern" }),
    );
    await renderBoard([]);

    await userEvent.type(screen.getByLabelText("Company"), "Initech");
    await userEvent.type(screen.getByLabelText("Role"), "SWE intern");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(await within(column("Saved")).findByText("Initech")).toBeDefined();
    expect(createApplication).toHaveBeenCalledWith({
      company: "Initech",
      role: "SWE intern",
      deadline: null,
    });
    // The form is cleared for the next entry.
    expect(screen.getByLabelText<HTMLInputElement>("Company").value).toBe("");
  });

  test("an API validation error is shown and the input is kept", async () => {
    vi.mocked(createApplication).mockRejectedValue(
      new ApiError("company: String should have at least 1 character", 422),
    );
    await renderBoard([]);

    await userEvent.type(screen.getByLabelText("Company"), "   ");
    await userEvent.type(screen.getByLabelText("Role"), "SWE intern");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "company: String should have at least 1 character",
    );
    expect(screen.getByLabelText<HTMLInputElement>("Role").value).toBe(
      "SWE intern",
    );
  });
});

describe("deleting a card", () => {
  test("removes the card after confirmation", async () => {
    vi.mocked(deleteApplication).mockResolvedValue(undefined);
    await renderBoard();

    await userEvent.click(
      screen.getByRole("button", { name: "Delete Acme, ML intern" }),
    );

    expect(screen.queryByText("Acme")).toBeNull();
    expect(deleteApplication).toHaveBeenCalledWith(1);
  });

  test("does nothing when the confirmation is cancelled", async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    await renderBoard();

    await userEvent.click(
      screen.getByRole("button", { name: "Delete Acme, ML intern" }),
    );

    expect(screen.getByText("Acme")).toBeDefined();
    expect(deleteApplication).not.toHaveBeenCalled();
  });

  test("a failed delete brings the card back", async () => {
    vi.mocked(deleteApplication).mockRejectedValue(
      new ApiError("Request failed (HTTP 500)", 500),
    );
    await renderBoard();

    await userEvent.click(
      screen.getByRole("button", { name: "Delete Acme, ML intern" }),
    );

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Could not delete: Request failed (HTTP 500)",
    );
    expect(within(column("Saved")).getByText("Acme")).toBeDefined();
  });
});

describe("editing an application", () => {
  function editForm(): HTMLElement {
    return screen.getByRole("form", { name: "Edit Acme, ML intern" });
  }

  test("saves the changed details and shows them on the card", async () => {
    vi.mocked(updateApplication).mockResolvedValue({
      ...acme,
      role: "Research intern",
      notes: "Referral from Sam",
    });
    await renderBoard();

    await userEvent.click(
      screen.getByRole("button", { name: "Edit Acme, ML intern" }),
    );
    const role = within(editForm()).getByLabelText("Role");
    await userEvent.clear(role);
    await userEvent.type(role, "Research intern");
    await userEvent.type(
      within(editForm()).getByLabelText("Notes"),
      "Referral from Sam",
    );
    await userEvent.click(
      within(editForm()).getByRole("button", { name: "Save" }),
    );

    expect(await screen.findByText("Research intern")).toBeDefined();
    expect(screen.getByText("Referral from Sam")).toBeDefined();
    expect(screen.queryByRole("form", { name: /^Edit/ })).toBeNull();
    // Empty optional fields are sent as null so that clearing a field clears it.
    expect(updateApplication).toHaveBeenCalledWith(1, {
      company: "Acme",
      role: "Research intern",
      url: null,
      applied_at: null,
      deadline: null,
      cv_version: null,
      notes: "Referral from Sam",
    });
  });

  test("an API error keeps the form open with the message", async () => {
    vi.mocked(updateApplication).mockRejectedValue(
      new ApiError("url: String should have at most 2000 characters", 422),
    );
    await renderBoard();

    await userEvent.click(
      screen.getByRole("button", { name: "Edit Acme, ML intern" }),
    );
    await userEvent.click(
      within(editForm()).getByRole("button", { name: "Save" }),
    );

    expect((await within(editForm()).findByRole("alert")).textContent).toBe(
      "url: String should have at most 2000 characters",
    );
    expect(
      within(editForm()).getByRole("button", { name: "Save" }),
    ).toBeDefined();
  });

  test("cancel closes the form without saving", async () => {
    await renderBoard();

    await userEvent.click(
      screen.getByRole("button", { name: "Edit Acme, ML intern" }),
    );
    await userEvent.type(within(editForm()).getByLabelText("Notes"), "draft");
    await userEvent.click(
      within(editForm()).getByRole("button", { name: "Cancel" }),
    );

    expect(screen.queryByRole("form", { name: /^Edit/ })).toBeNull();
    expect(screen.queryByText("draft")).toBeNull();
    expect(updateApplication).not.toHaveBeenCalled();
  });

  test("the company links to the posting only for web addresses", async () => {
    await renderBoard([
      makeApplication({
        id: 1,
        company: "Acme",
        url: "https://acme.test/jobs/1",
      }),
      makeApplication({ id: 2, company: "Evil", url: "javascript:alert(1)" }),
    ]);

    expect(
      screen.getByRole("link", { name: "Acme" }).getAttribute("href"),
    ).toBe("https://acme.test/jobs/1");
    expect(screen.queryByRole("link", { name: "Evil" })).toBeNull();
  });
});
