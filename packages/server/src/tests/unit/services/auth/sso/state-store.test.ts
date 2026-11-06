import { describe, it, expect, vi, afterEach } from "vitest";
import {
  issueSsoState,
  peekSsoState,
  consumeSsoState,
} from "@/services/auth/sso/state-store";

const returnTo = "https://sandbox.createrington.com/callback";

afterEach(() => {
  vi.useRealTimers();
});

describe("sso state-store", () => {
  it("peeks a freshly issued state without consuming it", async () => {
    const state = (await issueSsoState(returnTo))!;
    expect(await peekSsoState(state)).toEqual({ returnTo });
    expect(await peekSsoState(state)).toEqual({ returnTo });
  });

  it("consumes a state once, then misses", async () => {
    const state = (await issueSsoState(returnTo))!;
    expect(await consumeSsoState(state)).toEqual({ returnTo });
    expect(await consumeSsoState(state)).toBeNull();
    expect(await peekSsoState(state)).toBeNull();
  });

  it("returns null for an unknown state", async () => {
    expect(await peekSsoState("deadbeef")).toBeNull();
    expect(await consumeSsoState("deadbeef")).toBeNull();
  });

  it("expires a state after the 15m TTL", async () => {
    vi.useFakeTimers();
    const state = (await issueSsoState(returnTo))!;
    vi.advanceTimersByTime(15 * 60 * 1000 + 1);
    expect(await peekSsoState(state)).toBeNull();
    expect(await consumeSsoState(state)).toBeNull();
  });

  it("still resolves just before the TTL elapses", async () => {
    vi.useFakeTimers();
    const state = (await issueSsoState(returnTo))!;
    vi.advanceTimersByTime(14 * 60 * 1000);
    expect(await peekSsoState(state)).toEqual({ returnTo });
  });

  it("issues distinct states for separate flows", async () => {
    const a = (await issueSsoState("https://sandbox.createrington.com/a"))!;
    const b = (await issueSsoState("https://panel.createrington.com/b"))!;
    expect(a).not.toBe(b);
    expect((await consumeSsoState(a))?.returnTo).toBe(
      "https://sandbox.createrington.com/a",
    );
    expect((await consumeSsoState(b))?.returnTo).toBe(
      "https://panel.createrington.com/b",
    );
  });
});
