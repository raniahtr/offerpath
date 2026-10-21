import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import {
  analyzeFit,
  ApiError,
  type FitAnalysis,
  getFitPrompt,
  getLatestFit,
  saveManualFit,
} from "@/lib/api";

import { FitPanel } from "./FitPanel";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getLatestFit: vi.fn(),
  analyzeFit: vi.fn(),
  getFitPrompt: vi.fn(),
  saveManualFit: vi.fn(),
}));

const fit: FitAnalysis = {
  id: 1,
  posting_id: 7,
  score: 72,
  matched_skills: ["Python", "PyTorch"],
  missing_skills: ["Kubernetes"],
  explanation: "You fit most requirements.",
  source: "api",
  model: "openai/gpt-oss-120b",
  created_at: "2026-10-21T15:30:00Z",
};

async function renderPanel(latest: FitAnalysis | null = null) {
  vi.mocked(getLatestFit).mockResolvedValue(latest);
  render(<FitPanel postingId={7} />);
  await screen.findByRole("button", { name: /Analyse/ });
}

describe("result", () => {
  test("shows the score, its band and both skill lists", async () => {
    await renderPanel(fit);

    expect(screen.getByText("72")).toBeDefined();
    expect(screen.getByText("Partial fit")).toBeDefined();
    expect(
      screen
        .getByRole("meter", { name: "Fit score" })
        .getAttribute("aria-valuenow"),
    ).toBe("72");
    const matches = screen.getByRole("region", { name: "What matches" });
    expect(within(matches).getByText("PyTorch")).toBeDefined();
    const gaps = screen.getByRole("region", { name: "What's missing" });
    expect(within(gaps).getByText("Kubernetes")).toBeDefined();
    expect(screen.getByText(/with AI \(openai\/gpt-oss-120b\)/)).toBeDefined();
    expect(screen.getByRole("button", { name: "Analyse again" })).toBeDefined();
  });

  test("runs the AI when there is no analysis yet", async () => {
    const user = userEvent.setup();
    await renderPanel(null);
    vi.mocked(analyzeFit).mockResolvedValue(fit);

    expect(screen.getByText(/Not analysed yet/)).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Analyse with AI" }));

    expect(analyzeFit).toHaveBeenCalledWith(7);
    expect(await screen.findByText("Partial fit")).toBeDefined();
  });
});

describe("errors", () => {
  test("without a CV, explains it and links to the CV page", async () => {
    const user = userEvent.setup();
    await renderPanel(null);
    vi.mocked(analyzeFit).mockRejectedValue(
      new ApiError("Add your CV first", 409),
    );

    await user.click(screen.getByRole("button", { name: "Analyse with AI" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Add your CV first");
    expect(
      within(alert)
        .getByRole("link", { name: "Go to your CV" })
        .getAttribute("href"),
    ).toBe("/cv");
  });

  test("at the daily limit, offers the free own-chat mode", async () => {
    const user = userEvent.setup();
    await renderPanel(null);
    vi.mocked(analyzeFit).mockRejectedValue(
      new ApiError("You reached today's limit of 20 AI requests.", 429),
    );

    await user.click(screen.getByRole("button", { name: "Analyse with AI" }));
    await user.click(
      await screen.findByRole("button", { name: "Use your own chat instead" }),
    );

    expect(
      screen.getByRole("form", { name: "Use your own chat" }),
    ).toBeDefined();
  });
});

describe("own-chat mode", () => {
  test("copies the prompt, then validates and shows the pasted answer", async () => {
    const user = userEvent.setup(); // also provides a fake clipboard
    await renderPanel(null);
    vi.mocked(getFitPrompt).mockResolvedValue("PROMPT TEXT");
    vi.mocked(saveManualFit).mockResolvedValue({
      ...fit,
      source: "manual",
      model: null,
    });

    await user.click(screen.getByRole("button", { name: "Use my own chat" }));
    await user.click(screen.getByRole("button", { name: "Copy prompt" }));
    expect(await screen.findByText("Copied to your clipboard")).toBeDefined();
    expect(await navigator.clipboard.readText()).toBe("PROMPT TEXT");

    await user.click(screen.getByLabelText("Answer from your chat"));
    await user.paste('{"score": 72}');
    await user.click(screen.getByRole("button", { name: "Check and save" }));

    expect(saveManualFit).toHaveBeenCalledWith(7, '{"score": 72}');
    expect(await screen.findByText(/with your own chat/)).toBeDefined();
    expect(
      screen.queryByRole("form", { name: "Use your own chat" }),
    ).toBeNull();
  });

  test("shows the prompt to copy by hand when the clipboard is blocked", async () => {
    const user = userEvent.setup();
    await renderPanel(null);
    vi.mocked(getFitPrompt).mockResolvedValue("PROMPT TEXT");
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(
      new Error("denied"),
    );

    await user.click(screen.getByRole("button", { name: "Use my own chat" }));
    await user.click(screen.getByRole("button", { name: "Copy prompt" }));

    expect(
      await screen.findByLabelText("Prompt (select all and copy)"),
    ).toHaveProperty("value", "PROMPT TEXT");
  });

  test("explains why a pasted answer was rejected", async () => {
    const user = userEvent.setup();
    await renderPanel(null);
    vi.mocked(saveManualFit).mockRejectedValue(
      new ApiError("No JSON object found. Paste the chat's whole answer.", 422),
    );

    await user.click(screen.getByRole("button", { name: "Use my own chat" }));
    await user.type(screen.getByLabelText("Answer from your chat"), "hello");
    await user.click(screen.getByRole("button", { name: "Check and save" }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "No JSON object found",
    );
  });
});
