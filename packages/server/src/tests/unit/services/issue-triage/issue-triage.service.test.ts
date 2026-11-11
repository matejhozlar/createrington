import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requestedUrl, sentJson } from "@/tests/helpers/fetch";

const fetchMock = vi.fn<typeof fetch>();

vi.mock("@/config/env/env.config", () => ({
  env: {
    CLAUDE_API_URL: "http://claude-automation.test",
    ADMIN_CHAT_SECRET: "s".repeat(32),
  },
}));

const { issueTriageService } =
  await import("@/services/issue-triage/issue-triage.service");

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const running = {
  status: "active",
  result: null,
  issue: null,
  reason: null,
};

describe("IssueTriageService.waitForOutcome", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("returns the settled status once the session finishes", async () => {
    const filed = {
      status: "completed",
      result: "filed",
      issue: {
        repo: "Createrington/app",
        number: 1,
        title: "Map is down",
        url: "https://gitea.test/Createrington/app/issues/1",
      },
      reason: null,
    };
    fetchMock
      .mockResolvedValueOnce(json(running))
      .mockResolvedValueOnce(json(filed));

    const outcome = issueTriageService.waitForOutcome(7, 60_000);
    await vi.advanceTimersByTimeAsync(10_000);

    await expect(outcome).resolves.toEqual(filed);
  });

  it("settles as orphaned when claude-automation no longer knows the session", async () => {
    fetchMock.mockResolvedValueOnce(json({}, 404));

    const outcome = issueTriageService.waitForOutcome(7, 60_000);
    await vi.advanceTimersByTimeAsync(5_000);

    await expect(outcome).resolves.toMatchObject({
      status: "failed",
      result: "orphaned",
    });
  });

  it("logs the first failing poll once and keeps polling", async () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => logger);
    fetchMock.mockImplementation(async () => json({}, 401));

    const outcome = issueTriageService.waitForOutcome(7, 20_000);
    await vi.advanceTimersByTimeAsync(20_000);

    await expect(outcome).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

describe("IssueTriageService.start", () => {
  const request = {
    transcript: "the map is down",
    messageCount: 1,
    requestedBy: "matej",
    sourceLabel: "#support",
  };

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts the request with the shared secret and returns the session id", async () => {
    fetchMock.mockResolvedValueOnce(json({ sessionId: 12 }));

    await expect(issueTriageService.start(request)).resolves.toEqual({
      sessionId: 12,
    });

    expect(requestedUrl(fetchMock).href).toBe(
      "http://claude-automation.test/api/triage",
    );
    expect(sentJson(fetchMock)).toEqual(request);
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("X-Admin-Chat-Secret")).toBe(
      "s".repeat(32),
    );
  });

  it("reports busy when claude-automation answers 429", async () => {
    fetchMock.mockResolvedValueOnce(json({}, 429));

    await expect(issueTriageService.start(request)).rejects.toMatchObject({
      kind: "busy",
    });
  });

  it("reports failed for any other upstream status", async () => {
    fetchMock.mockResolvedValueOnce(json({}, 500));

    await expect(issueTriageService.start(request)).rejects.toMatchObject({
      kind: "failed",
    });
  });

  it("reports failed when the request never gets an answer", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));

    await expect(issueTriageService.start(request)).rejects.toMatchObject({
      kind: "failed",
    });
  });
});
