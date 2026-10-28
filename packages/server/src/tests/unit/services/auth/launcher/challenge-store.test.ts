import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  LauncherChallengeStore,
  __resetLauncherChallengesForTests,
  consumeLauncherChallenge,
  issueLauncherChallenge,
} from "@/services/auth/launcher/challenge-store";

function fakeRedis() {
  const expiries = new Map<string, number>();
  const redis = {
    isReady: true,
    failing: false,
    unansweredWrites: false,
    expiries,
    sendCommand: vi.fn(async (args: string[]): Promise<unknown> => {
      if (redis.failing) throw new Error("Redis is not connected");
      const [command, key] = args;
      if (command === "SET") {
        expiries.set(key!, Date.now() + Number(args[4]));
        if (redis.unansweredWrites) {
          throw new Error("Redis did not answer within 1000 ms");
        }
        return "OK";
      }
      if (command === "GETDEL") {
        const expiry = expiries.get(key!);
        expiries.delete(key!);
        return expiry !== undefined && expiry > Date.now() ? "1" : null;
      }
      throw new Error(`unexpected command ${command}`);
    }),
  };
  return redis;
}

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

describe("launcher challenge store with Redis", () => {
  it("keeps a challenge in Redis for 60 seconds, under a hash of the serverId", async () => {
    const redis = fakeRedis();
    const store = new LauncherChallengeStore(redis);

    const serverId = (await store.issue())!;

    const [command, key, , unit, ttl] = redis.sendCommand.mock.calls[0]![0];
    expect(command).toBe("SET");
    expect(key).toMatch(/^launcher:challenge:[0-9a-f]{64}$/);
    expect(key).not.toContain(serverId);
    expect([unit, ttl]).toEqual(["PX", "60000"]);
  });

  it("verifies a challenge after a restart of the app", async () => {
    const redis = fakeRedis();
    const serverId = (await new LauncherChallengeStore(redis).issue())!;

    const afterRestart = new LauncherChallengeStore(redis);

    expect(await afterRestart.consume(serverId)).toBe(true);
  });

  it("consumes a challenge exactly once", async () => {
    const redis = fakeRedis();
    const store = new LauncherChallengeStore(redis);
    const serverId = (await store.issue())!;

    expect(await store.consume(serverId)).toBe(true);
    expect(await store.consume(serverId)).toBe(false);
  });

  it("rejects a challenge after 60 seconds", async () => {
    const redis = fakeRedis();
    const store = new LauncherChallengeStore(redis);
    const serverId = (await store.issue())!;

    vi.advanceTimersByTime(61_000);

    expect(await store.consume(serverId)).toBe(false);
  });

  it("keeps a challenge in memory while Redis cannot be reached, and verifies it once Redis is back", async () => {
    const redis = fakeRedis();
    redis.isReady = false;
    const store = new LauncherChallengeStore(redis);

    const serverId = (await store.issue())!;
    expect(redis.sendCommand).not.toHaveBeenCalled();

    redis.isReady = true;
    expect(await store.consume(serverId)).toBe(true);
    expect(await store.consume(serverId)).toBe(false);
  });

  it("keeps a challenge in memory when Redis fails to take it", async () => {
    const redis = fakeRedis();
    redis.failing = true;
    const store = new LauncherChallengeStore(redis);

    const serverId = (await store.issue())!;

    expect(await store.consume(serverId)).toBe(true);
  });

  it("verifies a challenge once when Redis took the write without confirming it", async () => {
    const redis = fakeRedis();
    redis.unansweredWrites = true;
    const store = new LauncherChallengeStore(redis);

    const serverId = (await store.issue())!;
    redis.isReady = false;
    expect(await store.consume(serverId)).toBe(true);

    redis.isReady = true;
    redis.unansweredWrites = false;
    expect(redis.expiries.size).toBe(1);
    expect(await store.consume(serverId)).toBe(false);
  });

  it("does not verify a challenge held by a Redis that cannot be reached", async () => {
    const redis = fakeRedis();
    const store = new LauncherChallengeStore(redis);
    const serverId = (await store.issue())!;

    redis.isReady = false;

    expect(await store.consume(serverId)).toBe(false);
  });

  it("issues without a cap while Redis takes the challenges", async () => {
    const redis = fakeRedis();
    const store = new LauncherChallengeStore(redis);

    for (let i = 0; i < 10_001; i++) {
      expect(await store.issue()).not.toBeNull();
    }
  });
});
