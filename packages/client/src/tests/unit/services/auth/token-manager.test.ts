import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getAccessToken,
  retryAfterRefresh,
  setAccessToken,
} from "@/services/auth/token-manager";

const REFRESH_URL = "https://createrington.test/api/auth/refresh";

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
    target.addEventListener("auth:session-expired", sessionExpired);
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

  it("dispatches session-expired when the refresh request fails", async () => {
    const response = responseFrom("https://createrington.test/trpc/x", 401);
    fetchMock.mockRejectedValueOnce(new TypeError("network down"));

    await expect(retryAfterRefresh(response, retry)).resolves.toBe(response);

    expect(sessionExpired).toHaveBeenCalledTimes(1);
    expect(retry).not.toHaveBeenCalled();
  });

  it("never refreshes or retries a 401 from the refresh endpoint", async () => {
    const response = responseFrom(REFRESH_URL, 401);

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
