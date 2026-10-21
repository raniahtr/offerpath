import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

import {
  ApiError,
  createPosting,
  deletePosting,
  listPostings,
  type Posting,
} from "@/lib/api";

import { Postings } from "./Postings";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  listPostings: vi.fn(),
  createPosting: vi.fn(),
  deletePosting: vi.fn(),
}));

function makePosting(overrides: Partial<Posting>): Posting {
  return {
    id: 1,
    title: "ML Engineering Intern",
    company: "Globex",
    location: "Zurich",
    url: "https://jobs.example.com/1",
    description: "We need Python and PyTorch.",
    created_at: "2026-10-21T10:00:00Z",
    ...overrides,
  };
}

const globex = makePosting({ id: 1 });
const initech = makePosting({
  id: 2,
  title: "Data Intern",
  company: "Initech",
  location: null,
  url: "javascript:alert(1)",
});

function row(name: RegExp): HTMLElement {
  return screen.getByRole("listitem", { name });
}

async function renderPostings(postings: Posting[] = [globex, initech]) {
  vi.mocked(listPostings).mockResolvedValue(postings);
  render(<Postings />);
  await screen.findByRole("heading", { level: 1, name: "Postings" });
  if (postings.length)
    await screen.findByRole("list", { name: "Your postings" });
}

beforeEach(() => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

describe("listing", () => {
  test("shows each posting with its company, location and a safe link", async () => {
    await renderPostings();

    const first = row(/^ML Engineering Intern, Globex/);
    expect(within(first).getByText("Globex · Zurich")).toBeDefined();
    expect(
      within(first).getByRole("link", { name: /Open the ad/ }),
    ).toHaveProperty("href", "https://jobs.example.com/1");
    // A "javascript:" URL never becomes a link to the ad.
    expect(
      within(row(/^Data Intern, Initech/)).queryByRole("link", {
        name: /Open the ad/,
      }),
    ).toBeNull();
    // Each title opens the posting's own page.
    expect(
      within(first)
        .getByRole("link", { name: "ML Engineering Intern" })
        .getAttribute("href"),
    ).toBe("/postings/1");
    // With postings, the form stays closed until asked for.
    expect(screen.queryByRole("form", { name: "New posting" })).toBeNull();
  });

  test("with no postings, shows the form and an empty state", async () => {
    await renderPostings([]);

    expect(
      await screen.findByRole("form", { name: "New posting" }),
    ).toBeDefined();
    expect(screen.getByText("No postings yet")).toBeDefined();
  });

  test("shows the error when postings can't be loaded", async () => {
    vi.mocked(listPostings).mockRejectedValue(
      new ApiError("Could not reach the API. Is it running?", 0),
    );
    render(<Postings />);

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Could not reach the API",
    );
  });
});

describe("adding", () => {
  test("saves a pasted posting and puts it first", async () => {
    const user = userEvent.setup();
    await renderPostings([globex]);
    const created = makePosting({
      id: 3,
      title: "Research Intern",
      company: "Acme",
    });
    vi.mocked(createPosting).mockResolvedValue(created);

    await user.click(screen.getByRole("button", { name: "New posting" }));
    await user.type(screen.getByLabelText("Job title"), "Research Intern");
    await user.type(screen.getByLabelText("Company"), "Acme");
    await user.type(screen.getByLabelText(/^Job description/), "Python");
    await user.click(screen.getByRole("button", { name: "Save posting" }));

    expect(createPosting).toHaveBeenCalledWith({
      title: "Research Intern",
      company: "Acme",
      location: null,
      url: null,
      description: "Python",
    });
    const items = await screen.findAllByRole("listitem");
    expect(items[0].getAttribute("aria-label")).toBe("Research Intern, Acme");
    expect(screen.queryByRole("form", { name: "New posting" })).toBeNull();
  });

  test("keeps what was typed and shows the API's error", async () => {
    const user = userEvent.setup();
    await renderPostings([]);
    vi.mocked(createPosting).mockRejectedValue(
      new ApiError("url: String should have at most 2000 characters", 422),
    );

    await user.type(await screen.findByLabelText("Job title"), "Intern");
    await user.type(screen.getByLabelText("Company"), "Acme");
    await user.type(screen.getByLabelText(/^Job description/), "Python");
    await user.click(screen.getByRole("button", { name: "Save posting" }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "at most 2000",
    );
    expect(screen.getByLabelText("Job title")).toHaveProperty(
      "value",
      "Intern",
    );
  });
});

describe("deleting", () => {
  test("removes the posting after confirmation", async () => {
    const user = userEvent.setup();
    await renderPostings();
    vi.mocked(deletePosting).mockResolvedValue(undefined);

    await user.click(
      screen.getByRole("button", { name: "Delete Data Intern, Initech" }),
    );

    expect(deletePosting).toHaveBeenCalledWith(2);
    expect(screen.queryByRole("listitem", { name: /Initech/ })).toBeNull();
  });

  test("puts the posting back when the API refuses", async () => {
    const user = userEvent.setup();
    await renderPostings();
    vi.mocked(deletePosting).mockRejectedValue(new ApiError("Boom", 500));

    await user.click(
      screen.getByRole("button", { name: "Delete Data Intern, Initech" }),
    );

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Could not delete",
    );
    expect(row(/^Data Intern, Initech/)).toBeDefined();
  });

  test("does nothing when the confirmation is cancelled", async () => {
    const user = userEvent.setup();
    vi.mocked(window.confirm).mockReturnValue(false);
    await renderPostings();

    await user.click(
      screen.getByRole("button", { name: "Delete Data Intern, Initech" }),
    );

    expect(deletePosting).not.toHaveBeenCalled();
  });
});
