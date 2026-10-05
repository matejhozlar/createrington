import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { DailyCounter } from "@/services/daily-counter";

type Name = "calls" | "refused";

const NAMES = ["calls", "refused"] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

function fakeRedis() {
  const values = new Map<string, number>();
  const expiries = new Map<string, number>();
  const redis = {
    enabled: true,
    isReady: true,
    failing: false,
    values,
    expiries,
    sendCommand: vi.fn(async (args: string[]): Promise<unknown> => {
      if (redis.failing) throw new Error("Redis did not answer");
      const [command, key, amount] = args;
      if (command === "INCRBY") {
        const next = (values.get(key!) ?? 0) + Number(amount);
        values.set(key!, next);
        return next;
      }
      if (command === "PEXPIRE") {
        expiries.set(key!, Number(amount));
        return 1;
      }
      if (command === "MGET") {
        return args.slice(1).map((name) => {
          const value = values.get(name);
          return value === undefined ? null : String(value);
        });
      }
      throw new Error(`unexpected command ${command}`);
    }),
  };
  return redis;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-05T12:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("DailyCounter", () => {
  it("writes a count to Redis under the name and the UTC day", async () => {
    const redis = fakeRedis();
    const counter = new DailyCounter<Name>("count:test", redis);

    counter.add("calls");
    counter.add("calls");
    counter.add("refused");
    await counter.write();

    expect(redis.values.get("count:test:calls:2026-10-05")).toBe(2);
    expect(redis.values.get("count:test:refused:2026-10-05")).toBe(1);
  });

  it("keeps a day for the retention time", async () => {
    const redis = fakeRedis();
    const counter = new DailyCounter<Name>("count:test", redis, 30);

    counter.add("calls");
    await counter.write();

    expect(redis.expiries.get("count:test:calls:2026-10-05")).toBe(30 * DAY_MS);
  });

  it("reads the last days with today first and zero for a day without events", async () => {
    const redis = fakeRedis();
    const counter = new DailyCounter<Name>("count:test", redis);

    counter.add("calls", 3);
    await counter.write();
    vi.setSystemTime(new Date("2026-10-07T00:30:00.000Z"));
    counter.add("calls");
    counter.add("refused");
    await counter.write();

    expect(await counter.read(NAMES, 3)).toEqual({
      source: "redis",
      days: [
        { date: "2026-10-07", counts: { calls: 1, refused: 1 } },
        { date: "2026-10-06", counts: { calls: 0, refused: 0 } },
        { date: "2026-10-05", counts: { calls: 3, refused: 0 } },
      ],
    });
  });

  it("counts in memory for good when no Redis is configured", async () => {
    const redis = fakeRedis();
    redis.enabled = false;
    redis.isReady = false;
    const counter = new DailyCounter<Name>("count:test", redis);

    counter.add("calls");
    counter.add("calls");
    await counter.write();

    expect(redis.sendCommand).not.toHaveBeenCalled();
    expect(await counter.read(NAMES, 1)).toEqual({
      source: "memory",
      days: [{ date: "2026-10-05", counts: { calls: 2, refused: 0 } }],
    });
  });

  it("says the counts are unavailable while a configured Redis cannot be reached", async () => {
    const redis = fakeRedis();
    redis.values.set("count:test:calls:2026-10-05", 40);
    redis.isReady = false;
    const counter = new DailyCounter<Name>("count:test", redis);

    expect((await counter.read(NAMES, 1)).source).toBe("unavailable");
  });

  it("says the counts are unavailable when Redis fails the read", async () => {
    const redis = fakeRedis();
    redis.values.set("count:test:calls:2026-10-05", 40);
    redis.failing = true;
    const counter = new DailyCounter<Name>("count:test", redis);

    expect((await counter.read(NAMES, 1)).source).toBe("unavailable");

    redis.failing = false;
    expect(await counter.read(NAMES, 1)).toEqual({
      source: "redis",
      days: [{ date: "2026-10-05", counts: { calls: 40, refused: 0 } }],
    });
  });

  it("adds what it counted in memory once Redis is back", async () => {
    const redis = fakeRedis();
    redis.values.set("count:test:calls:2026-10-05", 10);
    redis.isReady = false;
    const counter = new DailyCounter<Name>("count:test", redis);

    counter.add("calls");
    counter.add("calls");
    await counter.write();
    redis.isReady = true;
    counter.add("calls");
    await counter.write();

    expect(redis.values.get("count:test:calls:2026-10-05")).toBe(13);
    expect((await counter.read(NAMES, 1)).days[0]?.counts.calls).toBe(13);
  });

  it("keeps a count Redis failed to take and writes it later", async () => {
    const redis = fakeRedis();
    redis.failing = true;
    const counter = new DailyCounter<Name>("count:test", redis);

    counter.add("calls");
    await counter.write();
    expect((await counter.read(NAMES, 1)).days[0]?.counts.calls).toBe(1);

    redis.failing = false;
    await counter.write();

    expect(redis.values.get("count:test:calls:2026-10-05")).toBe(1);
    expect((await counter.read(NAMES, 1)).days[0]?.counts.calls).toBe(1);
  });

  it("does not lose an event counted while a write is under way", async () => {
    const redis = fakeRedis();
    const counter = new DailyCounter<Name>("count:test", redis);
    let release: () => void = () => {};
    redis.sendCommand.mockImplementationOnce(async (args: string[]) => {
      await new Promise<void>((resolve) => (release = resolve));
      redis.values.set(args[1]!, Number(args[2]));
      return Number(args[2]);
    });

    counter.add("calls");
    await vi.advanceTimersByTimeAsync(0);
    counter.add("calls");
    release();
    await counter.write();

    expect(redis.values.get("count:test:calls:2026-10-05")).toBe(2);
  });

  it("forgets a day older than the retention time that was never written", async () => {
    const redis = fakeRedis();
    redis.isReady = false;
    const counter = new DailyCounter<Name>("count:test", redis, 2);

    counter.add("calls");
    vi.setSystemTime(new Date("2026-10-09T12:00:00.000Z"));
    counter.add("calls");
    await counter.write();
    redis.isReady = true;
    await counter.write();

    expect(redis.values.has("count:test:calls:2026-10-05")).toBe(false);
    expect(redis.values.get("count:test:calls:2026-10-09")).toBe(1);
  });
});
