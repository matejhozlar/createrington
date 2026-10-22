import { describe, it, expect, beforeEach } from "vitest";
import {
  CurseForgeBudget,
  CurseForgeBudgetError,
  type BudgetRedis,
} from "@/services/curseforge/budget";

const MINUTE_MS = 60_000;
const MINUTE_START = 1_700_000_040_000;
const MINUTE = MINUTE_START / MINUTE_MS;
const PREFIX = "test:curseforge:budget";

class FakeRedis implements BudgetRedis {
  enabled = true;
  isReady = true;
  failing = false;
  readonly commands: string[][] = [];
  readonly values = new Map<string, string>();

  async sendCommand(args: string[]): Promise<unknown> {
    this.commands.push(args);
    if (this.failing) throw new Error("Redis down");
    const [command, key, value] = args as [string, string, string?];
    switch (command) {
      case "INCR": {
        const count = Number(this.values.get(key) ?? 0) + 1;
        this.values.set(key, `${count}`);
        return count;
      }
      case "GET":
        return this.values.get(key) ?? null;
      case "SET":
        this.values.set(key, value!);
        return "OK";
      case "PEXPIRE":
        return 1;
      default:
        throw new Error(`unexpected command ${command}`);
    }
  }

  sent(command: string): string[][] {
    return this.commands.filter(([name]) => name === command);
  }
}

let redis: FakeRedis;
let now: number;
let limit: number;
let budget: CurseForgeBudget;

function makeBudget(store: BudgetRedis = redis): CurseForgeBudget {
  return new CurseForgeBudget(
    PREFIX,
    store,
    () => limit,
    () => now,
  );
}

async function refusal(
  act: () => Promise<unknown>,
): Promise<CurseForgeBudgetError> {
  try {
    await act();
  } catch (error) {
    if (error instanceof CurseForgeBudgetError) return error;
    throw error;
  }
  throw new Error("expected the budget to refuse");
}

beforeEach(() => {
  redis = new FakeRedis();
  now = MINUTE_START + 10_000;
  limit = 2;
  budget = makeBudget();
});

describe("CurseForgeBudget outside a budgeted context", () => {
  it("lets every call through without counting it", async () => {
    for (let call = 0; call < 5; call += 1) await budget.admit();

    expect(redis.sent("INCR")).toEqual([]);
    expect((await budget.read()).used).toBe(0);
  });
});

describe("CurseForgeBudget inside a budgeted context", () => {
  it("admits calls up to the limit and refuses the next until the minute is over", async () => {
    await budget.budgeted(async () => {
      await budget.admit();
      await budget.admit();
      const refused = await refusal(() => budget.admit());

      expect(refused.refusal).toBe("budget");
      expect(refused.retryAfterMs).toBe(50_000);
      expect(refused.retryAfterSeconds).toBe(50);
    });
  });

  it("starts over with the next minute", async () => {
    await budget.budgeted(async () => {
      await budget.admit();
      await budget.admit();
      await refusal(() => budget.admit());

      now = MINUTE_START + MINUTE_MS;

      await expect(budget.admit()).resolves.toBeUndefined();
    });
  });

  it("counts in Redis under the minute's key, which expires on its own", async () => {
    await budget.budgeted(() => budget.admit());

    expect(redis.sent("INCR")).toEqual([
      ["INCR", `${PREFIX}:minute:${MINUTE}`],
    ]);
    expect(redis.sent("PEXPIRE")).toEqual([
      ["PEXPIRE", `${PREFIX}:minute:${MINUTE}`, `${2 * MINUTE_MS}`],
    ]);
  });

  it("shares the count with another process through Redis", async () => {
    const other = makeBudget();
    await budget.budgeted(() => budget.admit());
    await other.budgeted(() => other.admit());

    const refused = await refusal(() => budget.budgeted(() => budget.admit()));

    expect(refused.refusal).toBe("budget");
  });

  it("keeps the call budgeted through awaited work", async () => {
    await budget.budgeted(async () => {
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await budget.admit();
    });

    expect(redis.sent("INCR")).toHaveLength(1);
  });

  it("counts in memory while Redis is not ready", async () => {
    redis.isReady = false;

    await budget.budgeted(async () => {
      await budget.admit();
      await budget.admit();
      const refused = await refusal(() => budget.admit());

      expect(refused.refusal).toBe("budget");
    });
    expect(redis.commands).toEqual([]);
  });

  it("counts in memory when Redis fails", async () => {
    redis.failing = true;

    await budget.budgeted(async () => {
      await budget.admit();
      await budget.admit();
      const refused = await refusal(() => budget.admit());

      expect(refused.refusal).toBe("budget");
    });
  });
});

describe("CurseForgeBudget after a 429", () => {
  it("holds every call off as long as the Retry-After says, budgeted or not", async () => {
    budget.hold("2");

    const outside = await refusal(() => budget.admit());
    const inside = await refusal(() => budget.budgeted(() => budget.admit()));

    expect(outside.refusal).toBe("hold");
    expect(outside.retryAfterMs).toBe(2_000);
    expect(inside.refusal).toBe("hold");
    expect(redis.sent("INCR")).toEqual([]);
  });

  it("lets calls through again once the hold is over", async () => {
    budget.hold("2");
    now += 2_000;

    await expect(budget.admit()).resolves.toBeUndefined();
  });

  it("holds for 30 seconds without a Retry-After, and with one it cannot read", async () => {
    budget.hold(null);
    expect((await refusal(() => budget.admit())).retryAfterMs).toBe(30_000);

    budget.forget();
    budget.hold("soon");
    expect((await refusal(() => budget.admit())).retryAfterMs).toBe(30_000);
  });

  it("reads a Retry-After given as a date", async () => {
    budget.hold(new Date(now + 5_000).toUTCString());

    expect((await refusal(() => budget.admit())).retryAfterMs).toBe(5_000);
  });

  it("holds at least a second and ten minutes at most", async () => {
    budget.hold("0");
    expect((await refusal(() => budget.admit())).retryAfterMs).toBe(1_000);

    budget.forget();
    budget.hold("99999999");
    expect((await refusal(() => budget.admit())).retryAfterMs).toBe(
      10 * MINUTE_MS,
    );
  });

  it("does not shorten a hold still running with a shorter one", async () => {
    budget.hold("10");
    budget.hold("2");

    expect((await refusal(() => budget.admit())).retryAfterMs).toBe(10_000);
  });

  it("shares the hold with another process through Redis", async () => {
    budget.hold("4");
    const other = makeBudget();

    const refused = await refusal(() => other.admit());

    expect(refused.refusal).toBe("hold");
    expect(refused.retryAfterMs).toBe(4_000);
    expect(redis.sent("SET")).toEqual([
      ["SET", `${PREFIX}:held-until`, `${now + 4_000}`, "PX", "4000"],
    ]);
  });

  it("holds in memory while Redis is not ready", async () => {
    redis.isReady = false;
    budget.hold("3");

    expect((await refusal(() => budget.admit())).refusal).toBe("hold");
    expect(redis.commands).toEqual([]);
  });

  it("forgets the hold on request", async () => {
    redis.isReady = false;
    budget.hold("3");
    budget.forget();

    await expect(budget.admit()).resolves.toBeUndefined();
  });
});

describe("CurseForgeBudget.read", () => {
  it("tells the minute's use, what was refused, when it resets and that nothing holds the key off", async () => {
    await budget.budgeted(async () => {
      await budget.admit();
      await budget.admit();
      await refusal(() => budget.admit());
      await refusal(() => budget.admit());
    });

    expect(await budget.read()).toEqual({
      limitPerMinute: 2,
      used: 2,
      refused: 2,
      resetsAt: new Date(MINUTE_START + MINUTE_MS).toISOString(),
      heldUntil: null,
      source: "redis",
    });
  });

  it("tells until when CurseForge is holding the key off", async () => {
    budget.hold("8");

    expect((await budget.read()).heldUntil).toBe(
      new Date(now + 8_000).toISOString(),
    );
  });

  it("tells when the count is this process's own", async () => {
    redis.isReady = false;
    await budget.budgeted(() => budget.admit());

    expect(await budget.read()).toMatchObject({ used: 1, source: "memory" });
  });
});
