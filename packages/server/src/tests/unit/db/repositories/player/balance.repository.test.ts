import { describe, it, expect, vi, beforeEach } from "vitest";

const { findAllPlayers, adminGrant, adminDeduct } = vi.hoisted(() => ({
  findAllPlayers: vi.fn(),
  adminGrant: vi.fn(),
  adminDeduct: vi.fn(),
}));

vi.mock("@/db", () => ({
  Q: { player: { findAll: findAllPlayers } },
  player: {},
  balanceRepo: { adminGrant, adminDeduct },
}));

import { PlayerBalanceRepository } from "@/db/repositories/player/balance";

const STEVE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ALEX = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const GHOST = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const repo = new PlayerBalanceRepository();

beforeEach(() => {
  vi.clearAllMocks();
  findAllPlayers.mockResolvedValue([
    { minecraftUuid: STEVE, minecraftUsername: "Steve" },
    { minecraftUuid: ALEX, minecraftUsername: "Alex" },
  ]);
  adminGrant.mockResolvedValue(125);
  adminDeduct.mockResolvedValue(75);
});

describe("PlayerBalanceRepository.bulkAdjust", () => {
  it("grants a positive amount to every player as the admin", async () => {
    const results = await repo.bulkAdjust(
      [STEVE, ALEX],
      25,
      "admin-discord",
      "Admin",
      "event prize",
    );

    expect(adminGrant.mock.calls).toEqual([
      [STEVE, 25, "admin-discord", "Admin", "event prize"],
      [ALEX, 25, "admin-discord", "Admin", "event prize"],
    ]);
    expect(adminDeduct).not.toHaveBeenCalled();
    expect(results).toEqual([
      {
        playerUuid: STEVE,
        playerUsername: "Steve",
        success: true,
        newBalance: 125,
      },
      {
        playerUuid: ALEX,
        playerUsername: "Alex",
        success: true,
        newBalance: 125,
      },
    ]);
  });

  it("deducts the absolute value of a negative amount", async () => {
    await repo.bulkAdjust([STEVE], -25, "admin-discord", "Admin", "exploit");

    expect(adminDeduct).toHaveBeenCalledWith(
      STEVE,
      25,
      "admin-discord",
      "Admin",
      "exploit",
    );
    expect(adminGrant).not.toHaveBeenCalled();
  });

  it("keeps going past a player whose adjustment fails and reports why", async () => {
    adminDeduct
      .mockRejectedValueOnce(
        new Error("Insufficient balance: has 10.000, needs 25.000"),
      )
      .mockResolvedValueOnce(75);

    const results = await repo.bulkAdjust(
      [STEVE, ALEX],
      -25,
      "admin-discord",
      "Admin",
      "exploit",
    );

    expect(results).toEqual([
      {
        playerUuid: STEVE,
        playerUsername: "Steve",
        success: false,
        error: "Insufficient balance: has 10.000, needs 25.000",
      },
      {
        playerUuid: ALEX,
        playerUsername: "Alex",
        success: true,
        newBalance: 75,
      },
    ]);
  });

  it("looks the usernames up in one query and labels an unknown UUID", async () => {
    adminGrant.mockRejectedValueOnce(new Error("Player not found"));

    const [ghost] = await repo.bulkAdjust(
      [GHOST],
      10,
      "admin-discord",
      "Admin",
      "refund",
    );

    expect(findAllPlayers).toHaveBeenCalledTimes(1);
    expect(findAllPlayers).toHaveBeenCalledWith(
      { minecraftUuid: { $in: [GHOST] } },
      { select: ["minecraftUuid", "minecraftUsername"] },
    );
    expect(ghost).toEqual({
      playerUuid: GHOST,
      playerUsername: "Unknown",
      success: false,
      error: "Player not found",
    });
  });

  it("skips the lookup for an empty list", async () => {
    await expect(
      repo.bulkAdjust([], 10, "admin-discord", "Admin", "refund"),
    ).resolves.toEqual([]);

    expect(findAllPlayers).not.toHaveBeenCalled();
  });
});
