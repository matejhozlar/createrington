import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { findAllClaims, createClaim, getPlayer, addBalance, inTransaction } =
  vi.hoisted(() => ({
    findAllClaims: vi.fn(),
    createClaim: vi.fn(),
    getPlayer: vi.fn(),
    addBalance: vi.fn(),
    inTransaction: vi.fn(),
  }));

vi.mock("@/db", () => ({
  Q: {
    reward: { claim: { findAll: findAllClaims, create: createClaim } },
    player: { get: getPlayer },
  },
  db: { inTransaction },
  balanceRepo: { add: addBalance },
}));

import { DailyRewardService } from "@/services/reward/daily-reward.service";
import { translateDbError } from "@/db/utils/errors";

const UUID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PLAYER = { minecraftUuid: UUID };
const TX = { reward: { claim: { create: createClaim } } };

function dailyReward(
  overrides: Partial<{ amount: number; resetHour: number }> = {},
): DailyRewardService {
  return new DailyRewardService({ amount: 20, resetHour: 0, ...overrides });
}

function lastClaimAt(iso: string): void {
  findAllClaims.mockResolvedValue([
    { claimedAt: new Date(iso), amount: 20_000n },
  ]);
}

beforeEach(() => {
  vi.useFakeTimers();
  findAllClaims.mockReset().mockResolvedValue([]);
  createClaim.mockReset().mockResolvedValue(undefined);
  getPlayer.mockReset();
  addBalance.mockReset().mockResolvedValue(120);
  inTransaction
    .mockReset()
    .mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn(TX));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("DailyRewardService.getNextClaimTime", () => {
  it.each([
    [
      "before the reset hour",
      6,
      "2026-11-08T04:00:00Z",
      "2026-11-08T06:00:00Z",
    ],
    ["after the reset hour", 6, "2026-11-08T07:00:00Z", "2026-11-09T06:00:00Z"],
    [
      "exactly at the reset hour",
      6,
      "2026-11-08T06:00:00Z",
      "2026-11-09T06:00:00Z",
    ],
    [
      "late in the day with a midnight reset",
      0,
      "2026-11-08T23:00:00Z",
      "2026-11-09T00:00:00Z",
    ],
    ["across a month end", 0, "2026-11-30T12:00:00Z", "2026-12-01T00:00:00Z"],
  ])("claimed %s", (_label, resetHour, claimedAt, expected) => {
    expect(
      dailyReward({ resetHour }).getNextClaimTime(new Date(claimedAt)),
    ).toEqual(new Date(expected));
  });
});

describe("DailyRewardService.checkEligibility", () => {
  it("lets a player who never claimed claim", async () => {
    vi.setSystemTime(new Date("2026-11-08T12:00:00Z"));

    await expect(dailyReward().checkEligibility(PLAYER)).resolves.toEqual({
      eligible: true,
    });
  });

  it("lets a player claim again once the reset hour has passed", async () => {
    vi.setSystemTime(new Date("2026-11-09T00:00:00Z"));
    lastClaimAt("2026-11-08T23:30:00Z");

    const result = await dailyReward().checkEligibility(PLAYER);

    expect(result.eligible).toBe(true);
    expect(result.lastClaimTime).toEqual(new Date("2026-11-08T23:30:00Z"));
  });

  it("refuses a second claim in the same period and says when the next one opens", async () => {
    vi.setSystemTime(new Date("2026-11-08T23:59:59Z"));
    lastClaimAt("2026-11-08T00:00:01Z");

    const result = await dailyReward().checkEligibility(PLAYER);

    expect(result).toEqual({
      eligible: false,
      reason: "Already claimed for this period",
      nextClaimTime: new Date("2026-11-09T00:00:00Z"),
      lastClaimTime: new Date("2026-11-08T00:00:01Z"),
    });
  });

  it("looks up the latest claim of this reward type for the player", async () => {
    vi.setSystemTime(new Date("2026-11-08T12:00:00Z"));

    await dailyReward().checkEligibility(PLAYER);

    expect(findAllClaims).toHaveBeenCalledWith(
      { playerMinecraftUuid: UUID, rewardType: "daily" },
      expect.objectContaining({ limit: 1, orderDirection: "desc" }),
    );
  });

  it("resolves a Discord identifier to the player's UUID", async () => {
    vi.setSystemTime(new Date("2026-11-08T12:00:00Z"));
    getPlayer.mockResolvedValue({ minecraftUuid: UUID });

    await dailyReward().checkEligibility({ discordId: "123" });

    expect(getPlayer).toHaveBeenCalledWith({ discordId: "123" });
    expect(findAllClaims).toHaveBeenCalledWith(
      expect.objectContaining({ playerMinecraftUuid: UUID }),
      expect.anything(),
    );
  });

  it("reports ineligible instead of throwing when the lookup fails", async () => {
    findAllClaims.mockRejectedValue(new Error("connection lost"));

    await expect(dailyReward().checkEligibility(PLAYER)).resolves.toEqual({
      eligible: false,
      reason: "Failed to check eligibility",
    });
  });
});

describe("DailyRewardService.claim", () => {
  it("records the claim, then credits the configured amount, in one transaction", async () => {
    vi.setSystemTime(new Date("2026-11-08T12:00:00Z"));

    const result = await dailyReward().claim(PLAYER);

    expect(result).toEqual({
      success: true,
      amount: 20,
      newBalance: 120,
      nextClaimTime: new Date("2026-11-09T00:00:00Z"),
    });
    expect(inTransaction).toHaveBeenCalledTimes(1);
    expect(createClaim).toHaveBeenCalledWith({
      playerMinecraftUuid: UUID,
      rewardType: "daily",
      claimPeriodKey: "2026-11-08",
      amount: 20_000n,
      metadata: { rewardType: "daily" },
    });
    expect(addBalance).toHaveBeenCalledWith(
      UUID,
      20,
      "Daily reward claimed",
      "reward",
      { metadata: { rewardType: "daily" }, tx: TX },
    );
    expect(createClaim.mock.invocationCallOrder[0]).toBeLessThan(
      addBalance.mock.invocationCallOrder[0],
    );
  });

  it("keys a claim made before the reset hour to the previous day's period", async () => {
    vi.setSystemTime(new Date("2026-11-08T05:00:00Z"));

    await dailyReward({ resetHour: 6 }).claim(PLAYER);

    expect(createClaim).toHaveBeenCalledWith(
      expect.objectContaining({ claimPeriodKey: "2026-11-07" }),
    );
  });

  it("pays nothing when the player already claimed this period", async () => {
    vi.setSystemTime(new Date("2026-11-08T12:00:00Z"));
    lastClaimAt("2026-11-08T01:00:00Z");

    const result = await dailyReward().claim(PLAYER);

    expect(result.success).toBe(false);
    expect(result.nextClaimTime).toEqual(new Date("2026-11-09T00:00:00Z"));
    expect(inTransaction).not.toHaveBeenCalled();
    expect(addBalance).not.toHaveBeenCalled();
  });

  it("loses a concurrent claim race on the unique index without crediting", async () => {
    vi.setSystemTime(new Date("2026-11-08T12:00:00Z"));
    createClaim.mockRejectedValue(
      translateDbError({ code: "23505", message: "duplicate key" }),
    );
    findAllClaims
      .mockResolvedValueOnce([])
      .mockResolvedValue([
        { claimedAt: new Date("2026-11-08T11:59:59Z"), amount: 20_000n },
      ]);

    const result = await dailyReward().claim(PLAYER);

    expect(result.success).toBe(false);
    expect(result.nextClaimTime).toEqual(new Date("2026-11-09T00:00:00Z"));
    expect(addBalance).not.toHaveBeenCalled();
  });

  it("reports a failed credit as an unsuccessful claim without leaking the cause", async () => {
    vi.setSystemTime(new Date("2026-11-08T12:00:00Z"));
    addBalance.mockRejectedValue(new Error("balance would overflow"));

    await expect(dailyReward().claim(PLAYER)).resolves.toEqual({
      success: false,
      error: "Failed to claim daily reward",
    });
  });
});
