// Typed client for the FastAPI backend. Types mirror api/app/schemas/application.py;
// keep them in sync when the API schema changes.

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
