import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getAccessToken,
  refreshAccessToken,
  refreshDelayMs,
  retryAfterRefresh,
  SESSION_EXPIRED_EVENT,
  setAccessToken,
} from "@/services/auth/token-manager";

const REFRESH_URL = "https://createrington.test/api/auth/refresh";
const MINUTE_MS = 60 * 1000;

function tokenWith(claims: Record<string, unknown>): string {
  const payload = btoa(JSON.stringify(claims))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `header.${payload}.signature`;
}

function responseFrom(url: string, status: number, body?: unknown): Response {
  const response = new Response(body ? JSON.stringify(body) : null, { status });
  Object.defineProperty(response, "url", { value: url });
  return response;
}

function refreshSucceeds(accessToken: string) {
  return responseFrom(REFRESH_URL, 200, {
    success: true,
    data: { accessToken, user: { discordId: "1" } },
  });
}

describe("retryAfterRefresh", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const sessionExpired = vi.fn();
  const retry = vi.fn<(accessToken: string) => Promise<Response>>();

  beforeEach(() => {
    const target = new EventTarget();
    target.addEventListener(SESSION_EXPIRED_EVENT, sessionExpired);
    vi.stubGlobal("window", target);
    vi.stubGlobal("fetch", fetchMock);
    setAccessToken("stale-token");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetAllMocks();
  });

  it("passes a successful response through without refreshing", async () => {
    const response = responseFrom("https://createrington.test/trpc/x", 200);

    await expect(retryAfterRefresh(response, retry)).resolves.toBe(response);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(retry).not.toHaveBeenCalled();
    expect(sessionExpired).not.toHaveBeenCalled();
  });

  it("passes a non-401 error through without refreshing", async () => {
    const response = responseFrom("https://createrington.test/trpc/x", 403);

    await expect(retryAfterRefresh(response, retry)).resolves.toBe(response);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(retry).not.toHaveBeenCalled();
  });

  it("retries with the new token after a successful refresh", async () => {
    const retried = responseFrom("https://createrington.test/trpc/x", 200);
    fetchMock.mockResolvedValueOnce(refreshSucceeds("fresh-token"));
    retry.mockResolvedValueOnce(retried);

    const result = await retryAfterRefresh(
      responseFrom("https://createrington.test/trpc/x", 401),
      retry,
    );

    expect(result).toBe(retried);
    expect(retry).toHaveBeenCalledExactlyOnceWith("fresh-token");
    expect(getAccessToken()).toBe("fresh-token");
    expect(sessionExpired).not.toHaveBeenCalled();
  });

  it("returns the retried response as is when it is a 401 again", async () => {
    const retried = responseFrom("https://createrington.test/trpc/x", 401);
    fetchMock.mockResolvedValueOnce(refreshSucceeds("fresh-token"));
    retry.mockResolvedValueOnce(retried);

    const result = await retryAfterRefresh(
      responseFrom("https://createrington.test/trpc/x", 401),
      retry,
    );

    expect(result).toBe(retried);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("dispatches session-expired once when the refresh is rejected", async () => {
    const response = responseFrom("https://createrington.test/trpc/x", 401);
    fetchMock.mockResolvedValueOnce(responseFrom(REFRESH_URL, 401));

    await expect(retryAfterRefresh(response, retry)).resolves.toBe(response);

    expect(sessionExpired).toHaveBeenCalledTimes(1);
    expect(retry).not.toHaveBeenCalled();
    expect(getAccessToken()).toBeNull();
  });

  it.each([
    [
      "the network is down",
      () => Promise.reject(new TypeError("network down")),
    ],
    [
      "the refresh is rate limited",
      () => Promise.resolve(responseFrom(REFRESH_URL, 429)),
    ],
    [
      "the server is restarting",
      () => Promise.resolve(responseFrom(REFRESH_URL, 502)),
    ],
  ])("keeps the session when %s", async (_label, refresh) => {
    const response = responseFrom("https://createrington.test/trpc/x", 401);
    fetchMock.mockImplementationOnce(refresh);

    await expect(retryAfterRefresh(response, retry)).resolves.toBe(response);

    expect(sessionExpired).not.toHaveBeenCalled();
    expect(retry).not.toHaveBeenCalled();
    expect(getAccessToken()).toBe("stale-token");
  });

  it.each([
    REFRESH_URL,
    "https://createrington.test/api/auth/discord/callback",
  ])("never refreshes or retries a 401 from %s", async (url) => {
    const response = responseFrom(url, 401);

    await expect(retryAfterRefresh(response, retry)).resolves.toBe(response);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(retry).not.toHaveBeenCalled();
    expect(sessionExpired).not.toHaveBeenCalled();
  });

  it("shares one refresh between concurrent 401 responses", async () => {
    fetchMock.mockResolvedValueOnce(refreshSucceeds("fresh-token"));
    retry.mockImplementation(() =>
      Promise.resolve(responseFrom("https://createrington.test/trpc/x", 200)),
    );

    await Promise.all([
      retryAfterRefresh(
        responseFrom("https://createrington.test/trpc/a", 401),
        retry,
      ),
      retryAfterRefresh(
        responseFrom("https://createrington.test/trpc/b", 401),
        retry,
      ),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(retry).toHaveBeenCalledTimes(2);
    expect(retry).toHaveBeenCalledWith("fresh-token");
  });
});

describe("refreshAccessToken", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    setAccessToken("stale-token");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetAllMocks();
  });

  it.each([
    ["a rejected refresh token", 401],
    ["an untrusted origin", 403],
    ["a deleted player", 404],
  ])(
    "reports %s as unauthorized and drops the token",
    async (_label, status) => {
      fetchMock.mockResolvedValueOnce(responseFrom(REFRESH_URL, status));

      await expect(refreshAccessToken()).resolves.toEqual({
        status: "unauthorized",
      });
      expect(getAccessToken()).toBeNull();
    },
  );

  it.each([
    ["a network error", () => Promise.reject(new TypeError("network down"))],
    ["a 408", () => Promise.resolve(responseFrom(REFRESH_URL, 408))],
    ["a 429", () => Promise.resolve(responseFrom(REFRESH_URL, 429))],
    ["a 503", () => Promise.resolve(responseFrom(REFRESH_URL, 503))],
    [
      "a malformed body",
      () => Promise.resolve(responseFrom(REFRESH_URL, 200, { success: false })),
    ],
  ])("reports %s as transient and keeps the token", async (_label, refresh) => {
    fetchMock.mockImplementationOnce(refresh);

    await expect(refreshAccessToken()).resolves.toEqual({
      status: "transient",
    });
    expect(getAccessToken()).toBe("stale-token");
  });

  it("stores the new token on success", async () => {
    fetchMock.mockResolvedValueOnce(refreshSucceeds("fresh-token"));

    const result = await refreshAccessToken();

    expect(result.status).toBe("ok");
    expect(getAccessToken()).toBe("fresh-token");
  });
});

describe("refreshDelayMs", () => {
  it("refreshes two minutes before a 15 minute token expires", () => {
    expect(refreshDelayMs(tokenWith({ iat: 1000, exp: 1000 + 15 * 60 }))).toBe(
      13 * MINUTE_MS,
    );
  });

  it("refreshes halfway through a token shorter than four minutes", () => {
    expect(refreshDelayMs(tokenWith({ iat: 1000, exp: 1000 + 60 }))).toBe(
      MINUTE_MS / 2,
    );
  });

  it("caps the delay at the longest timeout a browser can schedule", () => {
    expect(
      refreshDelayMs(tokenWith({ iat: 1000, exp: 1000 + 30 * 24 * 60 * 60 })),
    ).toBe(2 ** 31 - 1);
  });

  it("reads base64url payloads", () => {
    const token = tokenWith({ iat: 1000, exp: 1000 + 15 * 60, name: "~~~?" });

    expect(token).toMatch(/[-_]/);
    expect(refreshDelayMs(token)).toBe(13 * MINUTE_MS);
  });

  it.each([
    ["no token", null],
    ["a malformed token", "not-a-jwt"],
    ["a token without exp", tokenWith({ iat: 1000 })],
  ])("returns null for %s", (_label, token) => {
    expect(refreshDelayMs(token)).toBeNull();
  });
});
