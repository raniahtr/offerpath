import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

import {
  ApiError,
  type Cv,
  deleteCv,
  extractPdfText,
  getCv,
  saveCv,
} from "@/lib/api";

import { CvEditor } from "./CvEditor";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getCv: vi.fn(),
  saveCv: vi.fn(),
  deleteCv: vi.fn(),
  extractPdfText: vi.fn(),
}));

// Invented person: tests never use real CV data.
const stored: Cv = {
  content: "\\section{Experience} Ada Example, ML intern",
  format: "latex",
  updated_at: "2026-10-21T15:30:00Z",
};

function textarea(): HTMLTextAreaElement {
  return screen.getByRole("textbox", { name: /CV content/ });
}

function saveButton(): HTMLButtonElement {
  return screen.getByRole("button", { name: "Save CV" });
}

async function renderEditor(cv: Cv | null = stored) {
  vi.mocked(getCv).mockResolvedValue(cv);
  render(<CvEditor />);
  await screen.findByRole("form", { name: "Your CV" });
}

function pdfFile(): File {
  return new File(["%PDF-1.4 fake"], "cv.pdf", { type: "application/pdf" });
}

beforeEach(() => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

describe("loading", () => {
  test("shows the saved CV, its format and when it was saved", async () => {
    await renderEditor();

    expect(textarea().value).toBe(stored.content);
    expect(screen.getByRole("combobox", { name: "Format" })).toHaveProperty(
      "value",
      "latex",
    );
    expect(screen.getByText(/Last saved 21 Oct 2026/)).toBeDefined();
    expect(saveButton().disabled).toBe(true); // nothing changed yet
  });

  test("starts empty when there is no CV yet, without a delete button", async () => {
    await renderEditor(null);

    expect(textarea().value).toBe("");
    expect(screen.queryByRole("button", { name: "Delete CV" })).toBeNull();
  });

  test("shows the error when the CV can't be loaded", async () => {
    vi.mocked(getCv).mockRejectedValue(
      new ApiError("Could not reach the API. Is it running?", 0),
    );
    render(<CvEditor />);

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Could not reach the API",
    );
  });
});

describe("saving", () => {
  test("saves the pasted CV with its format", async () => {
    const user = userEvent.setup();
    await renderEditor(null);
    vi.mocked(saveCv).mockResolvedValue({
      content: "Ada Example",
      format: "text",
      updated_at: "2026-10-21T16:00:00Z",
    });

    await user.type(textarea(), "Ada Example");
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Format" }),
      "text",
    );
    await user.click(saveButton());

    expect(saveCv).toHaveBeenCalledWith("Ada Example", "text");
    expect((await screen.findByRole("status")).textContent).toBe("Saved");
    expect(saveButton().disabled).toBe(true);
  });

  test("keeps the text and shows the API's error when saving fails", async () => {
    const user = userEvent.setup();
    await renderEditor();
    vi.mocked(saveCv).mockRejectedValue(
      new ApiError("content: String should have at most 50000 characters", 422),
    );

    await user.type(textarea(), " more");
    await user.click(saveButton());

    expect((await screen.findByRole("alert")).textContent).toContain(
      "at most 50000",
    );
    expect(textarea().value).toBe(`${stored.content} more`);
  });
});

describe("PDF import", () => {
  test("fills in the PDF's text for review, without saving it", async () => {
    const user = userEvent.setup();
    await renderEditor(null);
    vi.mocked(extractPdfText).mockResolvedValue({
      text: "Ada Example\nML intern",
      pages: 2,
    });

    await user.upload(screen.getByLabelText("Import from PDF"), pdfFile());

    expect(textarea().value).toBe("Ada Example\nML intern");
    expect(screen.getByRole("combobox", { name: "Format" })).toHaveProperty(
      "value",
      "pdf",
    );
    expect(screen.getByRole("status").textContent).toContain("2 pages");
    expect(saveCv).not.toHaveBeenCalled();
  });

  test("asks before replacing text that's already there", async () => {
    const user = userEvent.setup();
    vi.mocked(window.confirm).mockReturnValue(false);
    await renderEditor();

    await user.upload(screen.getByLabelText("Import from PDF"), pdfFile());

    expect(extractPdfText).not.toHaveBeenCalled();
    expect(textarea().value).toBe(stored.content);
  });

  test("shows why a PDF couldn't be read", async () => {
    const user = userEvent.setup();
    await renderEditor(null);
    vi.mocked(extractPdfText).mockRejectedValue(
      new ApiError("No text found in this PDF (is it a scanned image?)", 422),
    );

    await user.upload(screen.getByLabelText("Import from PDF"), pdfFile());

    expect((await screen.findByRole("alert")).textContent).toContain(
      "scanned image",
    );
  });
});

describe("deleting", () => {
  test("deletes the CV after confirmation", async () => {
    const user = userEvent.setup();
    await renderEditor();
    vi.mocked(deleteCv).mockResolvedValue(undefined);

    await user.click(screen.getByRole("button", { name: "Delete CV" }));

    expect(deleteCv).toHaveBeenCalledOnce();
    expect(textarea().value).toBe("");
    expect(screen.queryByRole("button", { name: "Delete CV" })).toBeNull();
  });

  test("does nothing when the confirmation is cancelled", async () => {
    const user = userEvent.setup();
    vi.mocked(window.confirm).mockReturnValue(false);
    await renderEditor();

    await user.click(screen.getByRole("button", { name: "Delete CV" }));

    expect(deleteCv).not.toHaveBeenCalled();
    expect(textarea().value).toBe(stored.content);
  });
});
