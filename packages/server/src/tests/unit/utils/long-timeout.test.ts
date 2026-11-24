import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MAX_TIMEOUT_MS, setLongTimeout } from "@/utils/long-timeout";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("setLongTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-24T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires a delay 40 days out at its target, not after the setTimeout limit", async () => {
    const callback = vi.fn();
    setLongTimeout(callback, 40 * DAY_MS);

    await vi.advanceTimersByTimeAsync(MAX_TIMEOUT_MS + 1);
    expect(callback).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(40 * DAY_MS - MAX_TIMEOUT_MS - 2);
    expect(callback).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(callback).toHaveBeenCalledOnce();
  });

  it("fires a short delay once, like setTimeout", async () => {
    const callback = vi.fn();
    setLongTimeout(callback, 1000);

    await vi.advanceTimersByTimeAsync(999);
    expect(callback).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(callback).toHaveBeenCalledOnce();
  });

  it("stays cancelled when cleared after it re-armed past the limit", async () => {
    const callback = vi.fn();
    const timer = setLongTimeout(callback, 40 * DAY_MS);

    await vi.advanceTimersByTimeAsync(MAX_TIMEOUT_MS + 1);
    timer.clear();
    await vi.advanceTimersByTimeAsync(40 * DAY_MS);

    expect(callback).not.toHaveBeenCalled();
  });
});
