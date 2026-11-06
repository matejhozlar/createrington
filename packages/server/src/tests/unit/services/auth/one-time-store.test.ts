import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { OneTimeStore } from "@/services/auth/one-time-store";

interface Payload {
  returnTo: string;
}

const payload: Payload = { returnTo: "https://sandbox.createrington.com/a" };

function fakeRedis() {
  const entries = new Map<string, { value: string; expiresAt: number }>();
  const live = (key: string) => {
    const entry = entries.get(key);
    return entry && entry.expiresAt > Date.now() ? entry.value : null;
  };
  const redis = {
    isReady: true,
    failing: false,
    unansweredWrites: false,
    entries,
    sendCommand: vi.fn(async (args: string[]): Promise<unknown> => {
      if (redis.failing) throw new Error("Redis is not connected");
      const [command, key] = args;
      if (command === "SET") {
        entries.set(key!, {
          value: args[2]!,
          expiresAt: Date.now() + Number(args[4]),
        });
        if (redis.unansweredWrites) {
          throw new Error("Redis did not answer within 1000 ms");
        }
        return "OK";
      }
      if (command === "GET") return live(key!);
      if (command === "GETDEL") {
        const value = live(key!);
        entries.delete(key!);
        return value;
      }
      throw new Error(`unexpected command ${command}`);
    }),
  };
  return redis;
}

function makeStore(
  redis: ReturnType<typeof fakeRedis>,
  maxMemoryEntries = 100,
) {
  return new OneTimeStore<Payload>(redis, {
    keyPrefix: "test:token",
    ttlMs: 60_000,
    tokenBytes: 20,
    maxMemoryEntries,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("one-time store with Redis", () => {
  it("keeps a value in Redis for its TTL, under a hash of the token", async () => {
    const redis = fakeRedis();

    const token = (await makeStore(redis).issue(payload))!;

    expect(token).toMatch(/^[0-9a-f]{40}$/);
    const [command, key, value, unit, ttl] =
      redis.sendCommand.mock.calls[0]![0];
    expect(command).toBe("SET");
    expect(key).toMatch(/^test:token:[0-9a-f]{64}$/);
    expect(key).not.toContain(token);
    expect(JSON.parse(value!)).toEqual(payload);
    expect([unit, ttl]).toEqual(["PX", "60000"]);
  });

  it("hands the value back after a restart of the app", async () => {
    const redis = fakeRedis();
    const token = (await makeStore(redis).issue(payload))!;

    const afterRestart = makeStore(redis);

    expect(await afterRestart.peek(token)).toEqual(payload);
    expect(await afterRestart.consume(token)).toEqual(payload);
  });

  it("peeks without taking, then consumes exactly once", async () => {
    const store = makeStore(fakeRedis());
    const token = (await store.issue(payload))!;

    expect(await store.peek(token)).toEqual(payload);
    expect(await store.peek(token)).toEqual(payload);
    expect(await store.consume(token)).toEqual(payload);
    expect(await store.consume(token)).toBeNull();
    expect(await store.peek(token)).toBeNull();
  });

  it("answers null once the TTL is up", async () => {
    const store = makeStore(fakeRedis());
    const token = (await store.issue(payload))!;

    vi.advanceTimersByTime(61_000);

    expect(await store.peek(token)).toBeNull();
    expect(await store.consume(token)).toBeNull();
  });

  it("answers null for a token it never issued", async () => {
    const store = makeStore(fakeRedis());

    expect(await store.peek("a".repeat(40))).toBeNull();
    expect(await store.consume("a".repeat(40))).toBeNull();
  });

  it("keeps a value in memory while Redis cannot be reached, and hands it out once Redis is back", async () => {
    const redis = fakeRedis();
    redis.isReady = false;
    const store = makeStore(redis);

    const token = (await store.issue(payload))!;
    expect(redis.sendCommand).not.toHaveBeenCalled();

    redis.isReady = true;
    expect(await store.peek(token)).toEqual(payload);
    expect(await store.consume(token)).toEqual(payload);
    expect(await store.consume(token)).toBeNull();
  });

  it("keeps a value in memory when Redis fails to take it", async () => {
    const redis = fakeRedis();
    redis.failing = true;
    const store = makeStore(redis);

    const token = (await store.issue(payload))!;

    expect(await store.consume(token)).toEqual(payload);
  });

  it("hands a value out once when Redis stored it without confirming", async () => {
    const redis = fakeRedis();
    redis.unansweredWrites = true;
    const store = makeStore(redis);

    const token = (await store.issue(payload))!;
    redis.isReady = false;
    expect(await store.consume(token)).toEqual(payload);

    redis.isReady = true;
    redis.unansweredWrites = false;
    expect(redis.entries.size).toBe(1);
    expect(await store.consume(token)).toBeNull();
  });

  it("does not hand out a value held by a Redis that cannot be reached", async () => {
    const redis = fakeRedis();
    const store = makeStore(redis);
    const token = (await store.issue(payload))!;

    redis.isReady = false;

    expect(await store.peek(token)).toBeNull();
    expect(await store.consume(token)).toBeNull();
  });

  it("answers null for a value Redis holds that is not JSON", async () => {
    const redis = fakeRedis();
    const store = makeStore(redis);
    const token = (await store.issue(payload))!;
    const [key] = [...redis.entries.keys()];
    redis.entries.get(key!)!.value = "{not json";

    expect(await store.consume(token)).toBeNull();
  });

  it("issues without a cap while Redis takes the values", async () => {
    const store = makeStore(fakeRedis(), 2);

    for (let i = 0; i < 3; i++) {
      expect(await store.issue(payload)).not.toBeNull();
    }
  });
});

describe("one-time store in memory", () => {
  it("stops issuing at the memory cap and recovers once the values expire", async () => {
    const redis = fakeRedis();
    redis.isReady = false;
    const store = makeStore(redis, 2);

    expect(await store.issue(payload)).not.toBeNull();
    expect(await store.issue(payload)).not.toBeNull();
    expect(await store.issue(payload)).toBeNull();

    vi.advanceTimersByTime(61_000);

    expect(await store.issue(payload)).not.toBeNull();
  });

  it("still hands a value out just before its TTL is up", async () => {
    const redis = fakeRedis();
    redis.isReady = false;
    const store = makeStore(redis);
    const token = (await store.issue(payload))!;

    vi.advanceTimersByTime(59_000);

    expect(await store.peek(token)).toEqual(payload);
    expect(await store.consume(token)).toEqual(payload);
  });
});
