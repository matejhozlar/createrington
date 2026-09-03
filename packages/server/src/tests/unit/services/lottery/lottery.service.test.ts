import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const state = vi.hoisted(() => ({
  failTransaction: false,
  deducted: [] as Array<{ uuid: string; amount: number }>,
  credited: [] as Array<{ uuid: string; amount: number }>,
  ledger: [] as Array<{ transactionType: string; createdAt: string }>,
}));

vi.mock("@/config", () => ({
  default: {
    envMode: { isDev: false },
    economy: {
      lottery: {
        durationMs: 2 * 60 * 1000,
        minAmount: 10,
        startCooldownMs: 60 * 60 * 1000,
      },
    },
  },
}));

vi.mock("@/db", () => ({
  db: {
    inTransaction: async (fn: (tx: unknown) => Promise<void>) => {
      if (state.failTransaction) throw new Error("db down");
      await fn({ lottery: { participant: { create: async () => {} } } });
    },
    lottery: { participant: { findAll: async () => [], drop: async () => {} } },
  },
  Q: {
    player: {
      balance: {
        transaction: {
          findAll: async (
            filter: { transactionType: string },
            options: { limit: number },
          ) =>
            state.ledger
              .filter((e) => e.transactionType === filter.transactionType)
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
              .slice(0, options.limit),
        },
      },
    },
  },
  R: {
    balanceRepo: {
      deduct: async (uuid: string, amount: number) => {
        state.deducted.push({ uuid, amount });
      },
      add: async (uuid: string, amount: number) => {
        state.credited.push({ uuid, amount });
      },
    },
  },
}));

vi.mock("@/db/repositories/balance", () => ({
  BalanceTransactionType: {
    LOTTERY_ENTRY: "lottery_entry",
    LOTTERY_WIN: "lottery_win",
    LOTTERY_REFUND: "lottery_refund",
  },
}));

vi.mock("@/db/repositories/balance/utils", () => ({
  BalanceUtils: {
    toStorage: (amount: number) => Math.round(amount * 100),
    fromStorage: (stored: number) => stored / 100,
    formatTrimmed: (stored: number) => String(stored / 100),
  },
}));

vi.mock("@/services", () => ({
  getService: async () => ({ send: async () => {} }),
  Services: { WEB_MESSAGE_SERVICE: "WEB_MESSAGE_SERVICE" },
}));

vi.mock("@/discord/constants", () => ({
  Discord: { Channels: { railsNSails: { MINECRAFT_CHAT: "chat" } } },
}));

vi.mock("@/app/middleware", () =>
  vi.importActual("@/app/middleware/error-handler"),
);

import { LotteryService } from "@/services/lottery/lottery.service";
import { LotteryCooldownError } from "@/services/lottery/errors";

const T0 = new Date("2026-09-03T12:00:00.000Z");
const SECOND = 1000;
const MINUTE = 60 * SECOND;

function at(offsetMs: number): string {
  return new Date(T0.getTime() + offsetMs).toISOString();
}

describe("LotteryService start cooldown", () => {
  let service: LotteryService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    state.failTransaction = false;
    state.deducted = [];
    state.credited = [];
    state.ledger = [];
    service = new LotteryService();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("refuses a second round within the hour even after the first resolved", async () => {
    await service.start("host", "Host", 50);
    await vi.advanceTimersByTimeAsync(2 * MINUTE);
    expect(service.isActive()).toBe(false);
    expect(state.credited).toEqual([{ uuid: "host", amount: 50 }]);

    const failure = service.start("other", "Other", 50);
    await expect(failure).rejects.toBeInstanceOf(LotteryCooldownError);
    await expect(failure).rejects.toMatchObject({
      statusCode: 409,
      code: "LOTTERY_COOLDOWN",
      message: "Next lottery can start in 58 minutes",
      nextStartAt: new Date(T0.getTime() + 60 * MINUTE),
      details: { nextStartAt: "2026-09-03T13:00:00.000Z" },
    });
    expect(state.deducted).toEqual([{ uuid: "host", amount: 50 }]);
  });

  it("still refuses one second before the hour is up, then allows the next second", async () => {
    await service.start("host", "Host", 50);
    await vi.advanceTimersByTimeAsync(60 * MINUTE - SECOND);

    await expect(service.start("other", "Other", 20)).rejects.toMatchObject({
      message: "Next lottery can start in 1 second",
    });

    await vi.advanceTimersByTimeAsync(SECOND);

    await expect(service.start("other", "Other", 20)).resolves.toMatchObject({
      success: true,
      entryAmount: 20,
    });
    expect(service.isActive()).toBe(true);
  });

  it("reports an active round as in progress rather than on cooldown", async () => {
    await service.start("host", "Host", 50);

    await expect(service.start("other", "Other", 50)).rejects.toThrow(
      "A lottery is already in progress",
    );
  });

  it("does not arm the cooldown when the start fails", async () => {
    state.failTransaction = true;
    await expect(service.start("host", "Host", 50)).rejects.toThrow("db down");
    expect(service.isActive()).toBe(false);

    state.failTransaction = false;
    await expect(service.start("host", "Host", 50)).resolves.toMatchObject({
      success: true,
    });
  });

  it("leaves joining untouched by the cooldown", async () => {
    await service.start("host", "Host", 50);

    await expect(service.join("other", "Other", 30)).resolves.toMatchObject({
      totalPot: 80,
      participantCount: 2,
    });
  });

  describe("initialize", () => {
    it("restores the cooldown from the newest lottery entry in the ledger", async () => {
      state.ledger = [
        { transactionType: "lottery_entry", createdAt: at(-50 * MINUTE) },
        { transactionType: "lottery_entry", createdAt: at(-10 * MINUTE) },
        { transactionType: "lottery_win", createdAt: at(-5 * MINUTE) },
      ];

      await service.initialize();

      await expect(service.start("host", "Host", 50)).rejects.toMatchObject({
        nextStartAt: new Date(T0.getTime() + 50 * MINUTE),
      });
    });

    it("ignores ledger entries older than the cooldown", async () => {
      state.ledger = [
        { transactionType: "lottery_entry", createdAt: at(-61 * MINUTE) },
      ];

      await service.initialize();

      await expect(service.start("host", "Host", 50)).resolves.toMatchObject({
        success: true,
      });
    });

    it("starts open with an empty ledger", async () => {
      await service.initialize();

      await expect(service.start("host", "Host", 50)).resolves.toMatchObject({
        success: true,
      });
    });
  });
});
