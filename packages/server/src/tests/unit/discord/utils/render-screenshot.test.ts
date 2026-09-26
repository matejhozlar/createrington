import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { screenshotMock } = vi.hoisted(() => ({
  screenshotMock: vi.fn(),
}));

vi.mock("@/config", () => ({
  default: {
    puppeteer: { baseUrl: "http://127.0.0.1:5001", secret: "s3cret" },
  },
}));

vi.mock("@/services", () => ({
  getService: async () => ({ screenshot: screenshotMock }),
  Services: { PUPPETEER_SERVICE: "PUPPETEER_SERVICE" },
}));

type RenderScreenshot =
  typeof import("@/discord/utils/render-screenshot").renderScreenshot;

describe("renderScreenshot", () => {
  let renderScreenshot: RenderScreenshot;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    screenshotMock.mockReset();
    screenshotMock.mockImplementation(async () => ({
      buffer: Buffer.from(`render-${screenshotMock.mock.calls.length}`),
      format: "png",
    }));
    ({ renderScreenshot } = await import("@/discord/utils/render-screenshot"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reuses a /records render within the cache window", async () => {
    const first = await renderScreenshot("records", {});
    vi.advanceTimersByTime(59_000);
    const second = await renderScreenshot("records", {});

    expect(screenshotMock).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });

  it("renders /records again once the cache window has passed", async () => {
    await renderScreenshot("records", {});
    vi.advanceTimersByTime(60_000);
    const second = await renderScreenshot("records", {});

    expect(screenshotMock).toHaveBeenCalledTimes(2);
    expect(second?.toString()).toBe("render-2");
  });

  it("shares one in-flight /records render between concurrent callers", async () => {
    const [first, second] = await Promise.all([
      renderScreenshot("records", {}),
      renderScreenshot("records", {}),
    ]);

    expect(screenshotMock).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });

  it("retries /records on the next call after a failed render", async () => {
    screenshotMock.mockRejectedValueOnce(new Error("timeout"));

    const failed = await renderScreenshot("records", {});
    const retried = await renderScreenshot("records", {});

    expect(failed).toBeNull();
    expect(retried?.toString()).toBe("render-2");
  });

  it("renders player-specific pages on every call", async () => {
    await renderScreenshot("profile", { player: "Steve" });
    await renderScreenshot("profile", { player: "Steve" });

    expect(screenshotMock).toHaveBeenCalledTimes(2);
  });
});
