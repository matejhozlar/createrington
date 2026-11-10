import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AxiosError, AxiosHeaders } from "axios";

const client = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal<typeof import("axios")>();
  return {
    ...actual,
    default: { ...actual.default, create: () => client },
  };
});

vi.mock("@/config/env/env.config", () => ({
  env: {
    CLAUDE_API_URL: "http://claude-automation.test",
    ADMIN_CHAT_SECRET: "s".repeat(32),
  },
}));

const { issueTriageService } =
  await import("@/services/issue-triage/issue-triage.service");

function httpError(status: number): AxiosError {
  return new AxiosError("request failed", undefined, undefined, undefined, {
    status,
    statusText: "",
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: {},
  });
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
    client.get.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
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
    client.get
      .mockResolvedValueOnce({ data: running })
      .mockResolvedValueOnce({ data: filed });

    const outcome = issueTriageService.waitForOutcome(7, 60_000);
    await vi.advanceTimersByTimeAsync(10_000);

    await expect(outcome).resolves.toEqual(filed);
  });

  it("settles as orphaned when claude-automation no longer knows the session", async () => {
    client.get.mockRejectedValueOnce(httpError(404));

    const outcome = issueTriageService.waitForOutcome(7, 60_000);
    await vi.advanceTimersByTimeAsync(5_000);

    await expect(outcome).resolves.toMatchObject({
      status: "failed",
      result: "orphaned",
    });
  });

  it("logs the first failing poll once and keeps polling", async () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => logger);
    client.get.mockRejectedValue(httpError(401));

    const outcome = issueTriageService.waitForOutcome(7, 20_000);
    await vi.advanceTimersByTimeAsync(20_000);

    await expect(outcome).resolves.toBeNull();
    expect(client.get).toHaveBeenCalledTimes(4);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
