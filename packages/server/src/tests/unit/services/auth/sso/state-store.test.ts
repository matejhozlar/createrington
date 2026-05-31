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
  it("peeks a freshly issued state without consuming it", () => {
    const state = issueSsoState(returnTo);
    expect(peekSsoState(state)).toEqual({ returnTo });
    // Still readable: peek must not consume.
    expect(peekSsoState(state)).toEqual({ returnTo });
  });

  it("consumes a state once, then misses", () => {
    const state = issueSsoState(returnTo);
    expect(consumeSsoState(state)).toEqual({ returnTo });
    expect(consumeSsoState(state)).toBeNull();
    expect(peekSsoState(state)).toBeNull();
  });

  it("returns null for an unknown state", () => {
    expect(peekSsoState("deadbeef")).toBeNull();
    expect(consumeSsoState("deadbeef")).toBeNull();
  });

  it("expires a state after the 15m TTL", () => {
    vi.useFakeTimers();
    const state = issueSsoState(returnTo);
    vi.advanceTimersByTime(15 * 60 * 1000 + 1);
    expect(peekSsoState(state)).toBeNull();
    expect(consumeSsoState(state)).toBeNull();
  });

  it("still resolves just before the TTL elapses", () => {
    vi.useFakeTimers();
    const state = issueSsoState(returnTo);
    vi.advanceTimersByTime(14 * 60 * 1000);
    expect(peekSsoState(state)).toEqual({ returnTo });
  });

  it("issues distinct states for separate flows", () => {
    const a = issueSsoState("https://sandbox.createrington.com/a");
    const b = issueSsoState("https://panel.createrington.com/b");
    expect(a).not.toBe(b);
    expect(consumeSsoState(a)?.returnTo).toBe(
      "https://sandbox.createrington.com/a",
    );
    expect(consumeSsoState(b)?.returnTo).toBe(
      "https://panel.createrington.com/b",
    );
  });
});
