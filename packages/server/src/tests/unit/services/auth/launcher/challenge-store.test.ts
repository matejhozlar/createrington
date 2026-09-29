import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  __resetLauncherChallengesForTests,
  consumeLauncherChallenge,
  issueLauncherChallenge,
} from "@/services/auth/launcher/challenge-store";

describe("launcher challenge store", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    __resetLauncherChallengesForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("issues a 40-character hex serverId that differs every time", () => {
    const first = issueLauncherChallenge();
    const second = issueLauncherChallenge();

    expect(first).toMatch(/^[0-9a-f]{40}$/);
    expect(second).toMatch(/^[0-9a-f]{40}$/);
    expect(first).not.toBe(second);
  });

  it("consumes an issued serverId exactly once", () => {
    const serverId = issueLauncherChallenge()!;

    expect(consumeLauncherChallenge(serverId)).toBe(true);
    expect(consumeLauncherChallenge(serverId)).toBe(false);
  });

  it("rejects a serverId the server never issued", () => {
    expect(consumeLauncherChallenge("a".repeat(40))).toBe(false);
  });

  it("rejects a serverId after 60 seconds", () => {
    const serverId = issueLauncherChallenge()!;

    vi.advanceTimersByTime(61_000);

    expect(consumeLauncherChallenge(serverId)).toBe(false);
  });

  it("still accepts a serverId just before it expires", () => {
    const serverId = issueLauncherChallenge()!;

    vi.advanceTimersByTime(59_000);

    expect(consumeLauncherChallenge(serverId)).toBe(true);
  });

  it("stops issuing when the pending cap is reached and recovers after expiry", () => {
    for (let i = 0; i < 10_000; i++) {
      expect(issueLauncherChallenge()).not.toBeNull();
    }
    expect(issueLauncherChallenge()).toBeNull();

    vi.advanceTimersByTime(61_000);

    expect(issueLauncherChallenge()).not.toBeNull();
  });
});
