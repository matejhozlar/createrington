import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  __resetLauncherChallengesForTests,
  consumeLauncherChallenge,
  issueLauncherChallenge,
} from "@/services/auth/launcher/challenge-store";

beforeEach(() => {
  vi.useFakeTimers();
  __resetLauncherChallengesForTests();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("launcher challenge store without Redis", () => {
  it("issues a 40-character hex serverId that differs every time", async () => {
    const first = await issueLauncherChallenge();
    const second = await issueLauncherChallenge();

    expect(first).toMatch(/^[0-9a-f]{40}$/);
    expect(second).toMatch(/^[0-9a-f]{40}$/);
    expect(first).not.toBe(second);
  });

  it("consumes an issued serverId exactly once", async () => {
    const serverId = (await issueLauncherChallenge())!;

    expect(await consumeLauncherChallenge(serverId)).toBe(true);
    expect(await consumeLauncherChallenge(serverId)).toBe(false);
  });

  it("rejects a serverId the server never issued", async () => {
    expect(await consumeLauncherChallenge("a".repeat(40))).toBe(false);
  });

  it("rejects a serverId after 60 seconds", async () => {
    const serverId = (await issueLauncherChallenge())!;

    vi.advanceTimersByTime(61_000);

    expect(await consumeLauncherChallenge(serverId)).toBe(false);
  });

  it("still accepts a serverId just before it expires", async () => {
    const serverId = (await issueLauncherChallenge())!;

    vi.advanceTimersByTime(59_000);

    expect(await consumeLauncherChallenge(serverId)).toBe(true);
  });

  it("stops issuing when the pending cap is reached and recovers after expiry", async () => {
    for (let i = 0; i < 10_000; i++) {
      expect(await issueLauncherChallenge()).not.toBeNull();
    }
    expect(await issueLauncherChallenge()).toBeNull();

    vi.advanceTimersByTime(61_000);

    expect(await issueLauncherChallenge()).not.toBeNull();
  });
});
