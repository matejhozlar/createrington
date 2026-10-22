import { AsyncLocalStorage } from "node:async_hooks";
import config from "@/config";
import { redisService } from "@/services/redis";

const MINUTE_MS = 60_000;
const MINUTE_KEY_TTL_MS = 2 * MINUTE_MS;
const HOLD_WHEN_NOT_TOLD_MS = 30_000;
const SHORTEST_HOLD_MS = 1_000;
const LONGEST_HOLD_MS = 10 * MINUTE_MS;

/** What the budget needs from Redis: whether it is configured, whether it can be reached, and one raw command at a time. */
export interface BudgetRedis {
  readonly enabled: boolean;
  readonly isReady: boolean;
  sendCommand(args: string[]): Promise<unknown>;
}

/** Why a call was not let through: `hold` for a 429 CurseForge answered, `budget` for a minute whose budget is spent. */
export type CurseForgeRefusal = "hold" | "budget";

export interface CurseForgeBudgetState {
  limitPerMinute: number;
  /** Budgeted calls let through this minute. */
  used: number;
  /** Budgeted calls refused this minute because the budget was spent. */
  refused: number;
  /** When the minute's count starts over, ISO 8601. */
  resetsAt: string;
  /** Until when no call goes out because CurseForge answered 429, ISO 8601, or null while it is not holding the key off. */
  heldUntil: string | null;
  /** `redis` when the count is the one shared between processes, `memory` when it is this process's own. */
  source: "redis" | "memory";
}

/**
 * Thrown instead of a call to CurseForge: for a hold after a 429, or because
 * the budget of the minute is spent. `retryAfterMs` says when the next call
 * can go out.
 */
export class CurseForgeBudgetError extends Error {
  constructor(
    readonly refusal: CurseForgeRefusal,
    readonly retryAfterMs: number,
  ) {
    const seconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
    super(
      refusal === "hold"
        ? `CurseForge is holding this server off, try again in ${seconds} s`
        : `This server has asked CurseForge enough this minute, try again in ${seconds} s`,
    );
    this.name = "CurseForgeBudgetError";
  }

  /** The wait for an HTTP `Retry-After` header: whole seconds, at least 1. */
  get retryAfterSeconds(): number {
    return Math.max(1, Math.ceil(this.retryAfterMs / 1000));
  }
}

function toCount(reply: unknown): number {
  const count = Number(reply ?? 0);
  return Number.isFinite(count) ? count : 0;
}

function holdMs(retryAfter: string | null, now: number): number {
  let wait = HOLD_WHEN_NOT_TOLD_MS;
  if (retryAfter !== null) {
    const header = retryAfter.trim();
    if (/^\d+$/.test(header)) wait = Number(header) * 1000;
    else {
      const date = Date.parse(header);
      if (Number.isFinite(date)) wait = date - now;
    }
  }
  return Math.min(LONGEST_HOLD_MS, Math.max(SHORTEST_HOLD_MS, wait));
}

/**
 * Keeps this app's calls to the CurseForge API within a budget per minute,
 * shared between processes through Redis and kept in this process's memory
 * while Redis is not configured or cannot be reached. Only calls made inside
 * `budgeted` draw from the budget: the launcher's content lookups do, the
 * pack resolution and the admin tools do not. A 429 from CurseForge holds
 * every call off until the time its `Retry-After` names (30 seconds without
 * one, at least a second, 10 minutes at most), so a refusal is never
 * repeated. Admitting a call never fails: Redis trouble falls back to memory,
 * and the two are not synced. Singleton.
 */
export class CurseForgeBudget {
  private readonly context = new AsyncLocalStorage<boolean>();
  private minute = -1;
  private count = 0;
  private heldUntil = 0;

  constructor(
    private readonly prefix: string,
    private readonly redis: BudgetRedis,
    private readonly limitPerMinute: () => number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Runs `work` with every CurseForge call made inside it drawing from the budget. */
  budgeted<T>(work: () => Promise<T>): Promise<T> {
    return this.context.run(true, work);
  }

  /** Lets one call through, or throws `CurseForgeBudgetError`: for a hold, whichever the call, or for the budget of the minute, for a call inside `budgeted`. */
  async admit(): Promise<void> {
    const now = this.now();
    const heldUntil = await this.readHold(now);
    if (heldUntil > now) {
      throw new CurseForgeBudgetError("hold", heldUntil - now);
    }
    if (!this.context.getStore()) return;

    const minute = Math.floor(now / MINUTE_MS);
    const count = await this.take(minute);
    if (count > this.limitPerMinute()) {
      throw new CurseForgeBudgetError("budget", (minute + 1) * MINUTE_MS - now);
    }
  }

  /** Holds every call off as CurseForge's 429 asks with its `Retry-After` header, which may be missing. Returns at once. */
  hold(retryAfter: string | null): void {
    const now = this.now();
    const wait = holdMs(retryAfter, now);
    const until = now + wait;
    this.heldUntil = Math.max(this.heldUntil, until);
    if (!this.redis.isReady) return;
    this.redis
      .sendCommand(["SET", this.holdKey(), `${until}`, "PX", `${wait}`])
      .catch(() => undefined);
  }

  /** The budget's state this minute and whether CurseForge is holding the key off. */
  async read(): Promise<CurseForgeBudgetState> {
    const now = this.now();
    const minute = Math.floor(now / MINUTE_MS);
    const limitPerMinute = this.limitPerMinute();
    const { count, source } = await this.readCount(minute);
    const heldUntil = await this.readHold(now);
    return {
      limitPerMinute,
      used: Math.min(count, limitPerMinute),
      refused: Math.max(count - limitPerMinute, 0),
      resetsAt: new Date((minute + 1) * MINUTE_MS).toISOString(),
      heldUntil: heldUntil > now ? new Date(heldUntil).toISOString() : null,
      source,
    };
  }

  /** Forgets the hold and the minute's count this process keeps in memory. What Redis holds stays. */
  forget(): void {
    this.minute = -1;
    this.count = 0;
    this.heldUntil = 0;
  }

  private async take(minute: number): Promise<number> {
    if (this.redis.isReady) {
      try {
        const key = this.minuteKey(minute);
        const count = toCount(await this.redis.sendCommand(["INCR", key]));
        if (count === 1) {
          this.redis
            .sendCommand(["PEXPIRE", key, `${MINUTE_KEY_TTL_MS}`])
            .catch(() => undefined);
        }
        return count;
      } catch {
        return this.takeInMemory(minute);
      }
    }
    return this.takeInMemory(minute);
  }

  private takeInMemory(minute: number): number {
    if (this.minute !== minute) {
      this.minute = minute;
      this.count = 0;
    }
    this.count += 1;
    return this.count;
  }

  private async readCount(
    minute: number,
  ): Promise<{ count: number; source: CurseForgeBudgetState["source"] }> {
    if (this.redis.isReady) {
      try {
        const reply = await this.redis.sendCommand([
          "GET",
          this.minuteKey(minute),
        ]);
        return { count: toCount(reply), source: "redis" };
      } catch {
        return this.countInMemory(minute);
      }
    }
    return this.countInMemory(minute);
  }

  private countInMemory(minute: number): {
    count: number;
    source: CurseForgeBudgetState["source"];
  } {
    return {
      count: this.minute === minute ? this.count : 0,
      source: "memory",
    };
  }

  private async readHold(now: number): Promise<number> {
    if (this.heldUntil > now) return this.heldUntil;
    if (!this.redis.isReady) return 0;
    try {
      const reply = await this.redis.sendCommand(["GET", this.holdKey()]);
      const until = toCount(reply);
      if (until > now) this.heldUntil = until;
      return until;
    } catch {
      return 0;
    }
  }

  private minuteKey(minute: number): string {
    return `${this.prefix}:minute:${minute}`;
  }

  private holdKey(): string {
    return `${this.prefix}:held-until`;
  }
}

export const curseforgeBudget = new CurseForgeBudget(
  "curseforge:budget",
  redisService,
  () => config.curseforge.launcherCallsPerMinute,
);
