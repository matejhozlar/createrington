import { describe, it, expect, vi, afterEach } from "vitest";
import { RenderMemo } from "@/services/skin-api/render-memo";

afterEach(() => {
  vi.useRealTimers();
});

describe("RenderMemo", () => {
  it("shares one in-flight production between concurrent callers", async () => {
    const memo = new RenderMemo<string>(60_000, 10);
    const produce = vi.fn(async () => "png");

    const [a, b] = await Promise.all([
      memo.get("k", produce),
      memo.get("k", produce),
    ]);

    expect(a).toBe("png");
    expect(b).toBe("png");
    expect(produce).toHaveBeenCalledTimes(1);
  });

  it("drops a failed production so the next caller retries", async () => {
    const memo = new RenderMemo<string>(60_000, 10);
    const produce = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValueOnce("png");

    await expect(memo.get("k", produce)).rejects.toThrow("down");
    await expect(memo.get("k", produce)).resolves.toBe("png");
    expect(produce).toHaveBeenCalledTimes(2);
  });

  it("re-produces an entry once its ttl has passed", async () => {
    vi.useFakeTimers();
    const memo = new RenderMemo<string>(1_000, 10);
    const produce = vi.fn(async () => "png");

    await memo.get("k", produce);
    vi.advanceTimersByTime(999);
    await memo.get("k", produce);
    expect(produce).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(2);
    await memo.get("k", produce);
    expect(produce).toHaveBeenCalledTimes(2);
  });

  it("evicts the oldest entries beyond its capacity", async () => {
    const memo = new RenderMemo<string>(60_000, 2);
    const produce = vi.fn(async () => "png");

    await memo.get("a", produce);
    await memo.get("b", produce);
    await memo.get("c", produce);
    await memo.get("a", produce);

    expect(produce).toHaveBeenCalledTimes(4);
  });
});
