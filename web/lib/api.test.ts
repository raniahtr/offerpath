import { beforeEach, describe, expect, test, vi } from "vitest";

import { getAccessToken, redirectToSignIn } from "@/lib/auth/session";

import {
  ApiError,
  type Application,
  createApplication,
  createPosting,
  deleteApplication,
  deletePosting,
  extractPdfText,
  getCv,
  getLatestFit,
  getPosting,
  listApplications,
  listPostings,
  saveCv,
  saveManualFit,
  updateApplication,
} from "./api";

const sample: Application = {
  id: 1,
  company: "Acme",
  role: "ML intern",
  url: null,
  status: "saved",
  applied_at: null,
  deadline: "2026-11-30",
  notes: null,
  cv_version: null,
  created_at: "2026-10-17T10:00:00Z",
  updated_at: "2026-10-17T10:00:00Z",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// The real module talks to Neon Auth; here we choose which token (if any) "the session" has.
vi.mock("@/lib/auth/session", () => ({
  getAccessToken: vi.fn(),
  redirectToSignIn: vi.fn(),
}));

// A fake fetch per test: no real network calls, and we can inspect what was sent.
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.test/");
  vi.stubGlobal("fetch", fetchMock);
  vi.mocked(getAccessToken).mockResolvedValue("test-jwt");
});

describe("happy paths", () => {
  test("listApplications GETs the collection, with an optional status filter", async () => {
    fetchMock.mockResolvedValue(jsonResponse([sample]));

    await expect(listApplications()).resolves.toEqual([sample]);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "http://api.test/applications",
      expect.anything(),
    );

    fetchMock.mockResolvedValue(jsonResponse([]));
    await listApplications("offer");
    expect(fetchMock).toHaveBeenLastCalledWith(
      "http://api.test/applications?status=offer",
      expect.anything(),
    );
  });

  test("createApplication POSTs JSON", async () => {
    fetchMock.mockResolvedValue(jsonResponse(sample, 201));

    await expect(
      createApplication({ company: "Acme", role: "ML intern" }),
    ).resolves.toEqual(sample);
    const [, init] = fetchMock.mock.calls[0];
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({ "Content-Type": "application/json" });
    expect(JSON.parse(init?.body as string)).toEqual({
      company: "Acme",
      role: "ML intern",
    });
  });

  test("updateApplication PATCHes only the given fields", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ...sample, status: "applied" }));

    const updated = await updateApplication(1, { status: "applied" });
    expect(updated.status).toBe("applied");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/applications/1");
    expect(init?.method).toBe("PATCH");
    expect(JSON.parse(init?.body as string)).toEqual({ status: "applied" });
  });

  test("deleteApplication handles the empty 204 response", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(deleteApplication(1)).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0][1]?.method).toBe("DELETE");
  });
});

describe("authentication", () => {
  test("every request carries the signed-in user's token", async () => {
    fetchMock.mockResolvedValue(jsonResponse(sample, 201));

    await createApplication({ company: "Acme", role: "ML intern" });
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
      Authorization: "Bearer test-jwt",
      "Content-Type": "application/json",
    });
  });

  test("without a session no Authorization header is sent", async () => {
    vi.mocked(getAccessToken).mockResolvedValue(null);
    fetchMock.mockResolvedValue(jsonResponse([]));

    await listApplications();
    expect(fetchMock.mock.calls[0][1]?.headers).not.toHaveProperty(
      "Authorization",
    );
  });

  test("a 401 sends the user to sign in and still rejects", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: "Token expired" }, 401));

    await expect(listApplications()).rejects.toMatchObject({ status: 401 });
    expect(redirectToSignIn).toHaveBeenCalledOnce();
  });

  test("other errors do not redirect", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: "Not found" }, 404));

    await expect(listApplications()).rejects.toMatchObject({ status: 404 });
    expect(redirectToSignIn).not.toHaveBeenCalled();
  });
});

describe("failures", () => {
  test("a 404 surfaces FastAPI's detail message and the status", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ detail: "Application not found" }, 404),
    );

    const error = await updateApplication(99, { status: "offer" }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      message: "Application not found",
      status: 404,
    });
  });

  test("a 422 validation error becomes a readable field message", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          detail: [
            {
              loc: ["body", "company"],
              msg: "String should have at least 1 character",
            },
          ],
        },
        422,
      ),
    );

    await expect(
      createApplication({ company: "", role: "x" }),
    ).rejects.toMatchObject({
      message: "company: String should have at least 1 character",
      status: 422,
    });
  });

  test("an error without a JSON body falls back to the HTTP status", async () => {
    fetchMock.mockResolvedValue(new Response("Bad gateway", { status: 502 }));

    await expect(listApplications()).rejects.toMatchObject({
      message: "Request failed (HTTP 502)",
      status: 502,
    });
  });

  test("a network failure becomes status 0 with a hint", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(listApplications()).rejects.toMatchObject({
      message: "Could not reach the API. Is it running?",
      status: 0,
    });
  });

  test("a missing NEXT_PUBLIC_API_URL fails loudly instead of calling a wrong URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");

    await expect(listApplications()).rejects.toThrow(/NEXT_PUBLIC_API_URL/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("CV", () => {
  const cv = {
    content: "Ada Example",
    format: "text",
    updated_at: "2026-10-21T15:30:00Z",
  };

  test("getCv returns the CV, or null when there isn't one yet (404)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(cv));
    await expect(getCv()).resolves.toEqual(cv);

    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: "No CV yet" }, 404));
    await expect(getCv()).resolves.toBeNull();
  });

  test("getCv still rejects on other errors", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: "Boom" }, 500));

    await expect(getCv()).rejects.toMatchObject({ status: 500 });
  });

  test("saveCv PUTs the content and format", async () => {
    fetchMock.mockResolvedValue(jsonResponse(cv));

    await saveCv("Ada Example", "text");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/cv");
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(init?.body as string)).toEqual({
      content: "Ada Example",
      format: "text",
    });
  });

  test("extractPdfText sends the raw PDF, not JSON, with the token", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ text: "Ada", pages: 1 }));
    const file = new Blob(["%PDF-1.4"], { type: "application/pdf" });

    await expect(extractPdfText(file)).resolves.toEqual({
      text: "Ada",
      pages: 1,
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/cv/pdf");
    expect(init?.body).toBe(file);
    expect(init?.headers).toMatchObject({
      "Content-Type": "application/pdf",
      Authorization: "Bearer test-jwt",
    });
  });
});

describe("postings", () => {
  const posting = {
    id: 7,
    title: "ML Intern",
    company: "Globex",
    location: null,
    url: null,
    description: "Python",
    created_at: "2026-10-21T10:00:00Z",
  };

  test("list, get, create and delete hit the right URLs and methods", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([posting]));
    await expect(listPostings()).resolves.toEqual([posting]);
    expect(fetchMock.mock.calls[0][0]).toBe("http://api.test/postings");

    fetchMock.mockResolvedValueOnce(jsonResponse(posting));
    await getPosting(7);
    expect(fetchMock.mock.calls[1][0]).toBe("http://api.test/postings/7");

    fetchMock.mockResolvedValueOnce(jsonResponse(posting, 201));
    await createPosting({
      title: "ML Intern",
      company: "Globex",
      description: "Python",
    });
    expect(fetchMock.mock.calls[2][1]?.method).toBe("POST");

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(deletePosting(7)).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[3][1]?.method).toBe("DELETE");
  });

  test("someone else's posting is a 404 like a missing one", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ detail: "Posting not found" }, 404),
    );

    await expect(getPosting(99)).rejects.toMatchObject({
      status: 404,
      message: "Posting not found",
    });
  });
});

describe("fit", () => {
  test("getLatestFit returns null when the posting was never analysed (404)", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ detail: "No analysis yet" }, 404),
    );

    await expect(getLatestFit(7)).resolves.toBeNull();
    expect(fetchMock.mock.calls[0][0]).toBe("http://api.test/postings/7/fit");
  });

  test("saveManualFit POSTs the pasted answer as JSON", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 1 }, 201));

    await saveManualFit(7, '{"score": 72}');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/postings/7/fit/manual");
    expect(JSON.parse(init?.body as string)).toEqual({
      answer: '{"score": 72}',
    });
  });
});
