// Typed client for the FastAPI backend. Types mirror api/app/schemas/ (application.py, cv.py,
// posting.py, fit.py); keep them in sync when the API schema changes.

import { getAccessToken, redirectToSignIn } from "@/lib/auth/session";

export const APPLICATION_STATUSES = [
  "saved",
  "applied",
  "interview",
  "offer",
  "rejected",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export interface ApplicationCreate {
  company: string;
  role: string;
  url?: string | null;
  status?: ApplicationStatus;
  applied_at?: string | null; // ISO date, "YYYY-MM-DD"
  deadline?: string | null; // ISO date, "YYYY-MM-DD"
  notes?: string | null;
  cv_version?: string | null;
}

// PATCH semantics: only the fields that are sent get updated.
export type ApplicationUpdate = Partial<ApplicationCreate>;

export interface Application {
  id: number;
  company: string;
  role: string;
  url: string | null;
  status: ApplicationStatus;
  applied_at: string | null;
  deadline: string | null;
  notes: string | null;
  cv_version: string | null;
  created_at: string; // ISO datetime
  updated_at: string; // ISO datetime
}

/** Any failed API call. `status` is the HTTP status, or 0 when the API was unreachable. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function baseUrl(): string {
  // Must be written out literally: Next.js inlines NEXT_PUBLIC_ vars into the browser bundle
  // only for direct `process.env.NEXT_PUBLIC_...` references.
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) {
    throw new ApiError(
      "NEXT_PUBLIC_API_URL is not set (see web/.env.example)",
      0,
    );
  }
  return url.replace(/\/+$/, "");
}

interface ValidationIssue {
  loc: (string | number)[];
  msg: string;
}

/** Turns FastAPI's error body into one readable sentence. */
function errorMessage(body: unknown, status: number): string {
  const detail =
    typeof body === "object" && body !== null && "detail" in body
      ? body.detail
      : undefined;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    // 422: [{ loc: ["body", "company"], msg: "..." }, ...] -> "company: ..."
    return (detail as ValidationIssue[])
      .map(
        (issue) =>
          `${issue.loc.filter((p) => p !== "body").join(".")}: ${issue.msg}`,
      )
      .join("; ");
  }
  return `Request failed (HTTP ${status})`;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    const url = `${baseUrl()}${path}`;
    const token = await getAccessToken();
    response = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        // The API checks this JWT's signature and only returns the signed-in user's rows.
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    // fetch only rejects on network failure (API down, CORS, offline), never on HTTP errors.
    throw new ApiError("Could not reach the API. Is it running?", 0);
  }

  if (response.status === 401) {
    // Signed out or session expired: send the user to sign in instead of showing an error.
    redirectToSignIn();
  }
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => undefined);
    throw new ApiError(errorMessage(body, response.status), response.status);
  }
  // 204 No Content (DELETE) has no body to parse.
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function listApplications(
  status?: ApplicationStatus,
): Promise<Application[]> {
  const query = status ? `?status=${status}` : "";
  return request(`/applications${query}`);
}

export function createApplication(
  data: ApplicationCreate,
): Promise<Application> {
  return request("/applications", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateApplication(
  id: number,
  data: ApplicationUpdate,
): Promise<Application> {
  return request(`/applications/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteApplication(id: number): Promise<void> {
  return request(`/applications/${id}`, { method: "DELETE" });
}

// --- CV (one per user) ---

export type CvFormat = "latex" | "text" | "pdf";

export interface Cv {
  content: string;
  format: CvFormat;
  updated_at: string; // ISO datetime
}

export interface PdfText {
  text: string;
  pages: number;
}

/** The signed-in user's CV, or null if they haven't saved one yet. */
export async function getCv(): Promise<Cv | null> {
  try {
    return await request<Cv>("/cv");
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export function saveCv(content: string, format: CvFormat): Promise<Cv> {
  return request("/cv", {
    method: "PUT",
    body: JSON.stringify({ content, format }),
  });
}

export function deleteCv(): Promise<void> {
  return request("/cv", { method: "DELETE" });
}

/** Sends the raw PDF; the API returns its text for review and stores nothing. */
export function extractPdfText(file: Blob): Promise<PdfText> {
  return request("/cv/pdf", {
    method: "POST",
    body: file,
    headers: { "Content-Type": "application/pdf" },
  });
}

// --- Postings (job ads the user pasted) ---

export interface PostingCreate {
  title: string;
  company: string;
  location?: string | null;
  url?: string | null;
  description: string;
}

export interface Posting {
  id: number;
  title: string;
  company: string;
  location: string | null;
  url: string | null;
  description: string;
  created_at: string; // ISO datetime
}

export function listPostings(): Promise<Posting[]> {
  return request("/postings");
}

export function createPosting(data: PostingCreate): Promise<Posting> {
  return request("/postings", { method: "POST", body: JSON.stringify(data) });
}

export function getPosting(id: number): Promise<Posting> {
  return request(`/postings/${id}`);
}

export function deletePosting(id: number): Promise<void> {
  return request(`/postings/${id}`, { method: "DELETE" });
}

// --- Fit analysis (CV vs posting) ---

export interface FitAnalysis {
  id: number;
  posting_id: number;
  score: number; // 0-100
  matched_skills: string[];
  missing_skills: string[];
  explanation: string;
  source: "api" | "manual"; // the app's AI, or the user's own chat
  model: string | null;
  created_at: string; // ISO datetime
}

/** The latest analysis of a posting, or null if there is none yet. */
export async function getLatestFit(
  postingId: number,
): Promise<FitAnalysis | null> {
  try {
    return await request<FitAnalysis>(`/postings/${postingId}/fit`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/** Runs the app's AI. Identical inputs return the stored analysis without a new AI call.
 * Fails with 409 (no CV yet), 429 (daily limit), 503 (AI off or busy), 502 (bad answer). */
export function analyzeFit(postingId: number): Promise<FitAnalysis> {
  return request(`/postings/${postingId}/fit`, { method: "POST" });
}

/** The full prompt, for the user to run in their own chat (free, no daily limit). */
export async function getFitPrompt(postingId: number): Promise<string> {
  const { prompt } = await request<{ prompt: string }>(
    `/postings/${postingId}/fit/prompt`,
  );
  return prompt;
}

/** Validates and saves the answer pasted back from the user's own chat (422 if invalid). */
export function saveManualFit(
  postingId: number,
  answer: string,
): Promise<FitAnalysis> {
  return request(`/postings/${postingId}/fit/manual`, {
    method: "POST",
    body: JSON.stringify({ answer }),
  });
}
