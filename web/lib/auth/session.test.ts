import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { authClient } from "./client";
import { clearAccessToken, getAccessToken } from "./session";

vi.mock("./client", () => ({ authClient: { token: vi.fn() } }));

const tokenEndpoint = vi.mocked(authClient.token);
const NOW = new Date("2026-10-18T12:00:00Z").getTime();

/** An unsigned JWT-shaped string expiring `seconds` from NOW (only `exp` is read). */
function fakeJwt(seconds: number, name = "t"): string {
  const payload = btoa(JSON.stringify({ exp: NOW / 1000 + seconds, name }));
  return `header.${payload}.signature`;
}

function respondWith(token: string | null) {
  tokenEndpoint.mockResolvedValue({
    data: token ? { token } : null,
    error: null,
  } as never);
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW });
  clearAccessToken();
});

afterEach(() => {
  vi.useRealTimers();
});

test("fetches a token, then reuses it while it is still valid", async () => {
  const jwt = fakeJwt(15 * 60);
  respondWith(jwt);

  expect(await getAccessToken()).toBe(jwt);
  vi.advanceTimersByTime(10 * 60_000);
  expect(await getAccessToken()).toBe(jwt);
  expect(tokenEndpoint).toHaveBeenCalledOnce();
});

test("fetches a new token shortly before the old one expires", async () => {
  respondWith(fakeJwt(15 * 60, "first"));
  await getAccessToken();

  vi.advanceTimersByTime(15 * 60_000 - 20_000); // 20 s left: inside the safety margin
  const second = fakeJwt(30 * 60, "second");
  respondWith(second);
  expect(await getAccessToken()).toBe(second);
  expect(tokenEndpoint).toHaveBeenCalledTimes(2);
});

test("returns null when signed out, and does not cache that", async () => {
  respondWith(null);
  expect(await getAccessToken()).toBeNull();

  respondWith(fakeJwt(60));
  expect(await getAccessToken()).not.toBeNull();
});

test("a token with an unreadable payload is never reused", async () => {
  respondWith("not-a-jwt");
  await getAccessToken();
  await getAccessToken();
  expect(tokenEndpoint).toHaveBeenCalledTimes(2);
});

test("clearAccessToken forgets the cached token (sign-out)", async () => {
  respondWith(fakeJwt(15 * 60));
  await getAccessToken();
  clearAccessToken();
  await getAccessToken();
  expect(tokenEndpoint).toHaveBeenCalledTimes(2);
});
