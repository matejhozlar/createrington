import { describe, it, expect, vi, beforeEach } from "vitest";

const { balanceRepo, bulkAdjust } = vi.hoisted(() => ({
  balanceRepo: {
    adminGrant: vi.fn(),
    adminDeduct: vi.fn(),
    adminSet: vi.fn(),
  },
  bulkAdjust: vi.fn(),
}));

vi.mock("@/db", () => ({ balanceRepo }));
vi.mock("@/services/player", () => ({
  playerService: { balance: { bulkAdjust } },
}));
vi.mock("@/services/auth/admin-status/admin-status.service", () => ({
  adminStatusService: { isAdmin: vi.fn().mockResolvedValue(true) },
}));

import { TRPCError } from "@trpc/server";
import { AuthRole } from "@createrington/shared/auth";
import { balanceRouter } from "@/trpc/routers/admin/players/balance";
import { NotFoundError } from "@/app/middleware/error-handler";
import type { Context } from "@/trpc/context";

const PLAYER_UUID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ADMIN = {
  discordId: "100000000000000009",
  username: "admin",
  minecraftUsername: "Admin",
  minecraftUuid: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  role: AuthRole.ADMIN,
  isAdmin: true,
};

const caller = balanceRouter.createCaller({
  user: ADMIN,
  service: null,
  ip: "127.0.0.1",
} satisfies Context);

async function rejection(call: Promise<unknown>): Promise<TRPCError> {
  try {
    await call;
  } catch (error) {
    if (error instanceof TRPCError) return error;
    throw error;
  }
  throw new Error("expected the call to be rejected");
}

beforeEach(() => {
  vi.clearAllMocks();
  balanceRepo.adminGrant.mockResolvedValue(150);
  balanceRepo.adminDeduct.mockResolvedValue(50);
  balanceRepo.adminSet.mockResolvedValue(0);
});

describe("admin.players.balance.adjust", () => {
  const input = {
    id: PLAYER_UUID,
    mode: "add" as const,
    amount: 50,
    reason: "event prize",
  };

  it.each([
    ["add", balanceRepo.adminGrant, 150],
    ["remove", balanceRepo.adminDeduct, 50],
    ["set", balanceRepo.adminSet, 0],
  ] as const)(
    "routes %s to its repository call with the admin as the actor",
    async (mode, repoCall, balance) => {
      await expect(caller.adjust({ ...input, mode })).resolves.toEqual({
        balance,
      });

      expect(repoCall).toHaveBeenCalledWith(
        { minecraftUuid: PLAYER_UUID },
        50,
        ADMIN.discordId,
        ADMIN.minecraftUsername,
        "event prize",
      );
    },
  );

  it("accepts a player by username or Discord ID", async () => {
    await caller.adjust({ ...input, id: "Steve" });
    await caller.adjust({ ...input, id: "100000000000000001" });

    expect(balanceRepo.adminGrant.mock.calls.map(([id]) => id)).toEqual([
      { minecraftUsername: "Steve" },
      { discordId: "100000000000000001" },
    ]);
  });

  it("trims the reason before it is recorded", async () => {
    await caller.adjust({ ...input, reason: "  event prize  " });

    expect(balanceRepo.adminGrant).toHaveBeenCalledWith(
      expect.anything(),
      50,
      ADMIN.discordId,
      ADMIN.minecraftUsername,
      "event prize",
    );
  });

  it.each(["add", "remove"] as const)(
    "refuses to %s zero dollars",
    async (mode) => {
      const error = await rejection(
        caller.adjust({ ...input, mode, amount: 0 }),
      );

      expect(error).toMatchObject({
        code: "BAD_REQUEST",
        message: "Amount must be greater than zero",
      });
      expect(balanceRepo.adminGrant).not.toHaveBeenCalled();
      expect(balanceRepo.adminDeduct).not.toHaveBeenCalled();
    },
  );

  it("lets a balance be set to zero", async () => {
    await caller.adjust({ ...input, mode: "set", amount: 0 });

    expect(balanceRepo.adminSet).toHaveBeenCalledWith(
      expect.anything(),
      0,
      ADMIN.discordId,
      ADMIN.minecraftUsername,
      "event prize",
    );
  });

  it.each([0.29, 19.99, 1_000_000_000])(
    "accepts %d dollars",
    async (amount) => {
      await caller.adjust({ ...input, amount });

      expect(balanceRepo.adminGrant).toHaveBeenCalledWith(
        expect.anything(),
        amount,
        ADMIN.discordId,
        ADMIN.minecraftUsername,
        "event prize",
      );
    },
  );

  it.each([
    ["fractions of a cent", 0.001],
    ["a negative amount", -5],
    ["more than the adjustment cap", 1_000_000_001],
  ])("rejects %s without touching the balance", async (_label, amount) => {
    const error = await rejection(caller.adjust({ ...input, amount }));

    expect(error.code).toBe("BAD_REQUEST");
    expect(balanceRepo.adminGrant).not.toHaveBeenCalled();
  });

  it.each([
    ["an empty reason", ""],
    ["a whitespace-only reason", "   "],
  ])("rejects %s", async (_label, reason) => {
    const error = await rejection(caller.adjust({ ...input, reason }));

    expect(error.code).toBe("BAD_REQUEST");
    expect(balanceRepo.adminGrant).not.toHaveBeenCalled();
  });

  it("rejects an id that is no kind of player identifier", async () => {
    const error = await rejection(
      caller.adjust({ ...input, id: "not a player!" }),
    );

    expect(error.code).toBe("BAD_REQUEST");
    expect(balanceRepo.adminGrant).not.toHaveBeenCalled();
  });

  it("tells the admin when the player cannot cover a removal", async () => {
    balanceRepo.adminDeduct.mockRejectedValue(
      new Error("Insufficient balance: has 10.000, needs 50.000"),
    );

    const error = await rejection(caller.adjust({ ...input, mode: "remove" }));

    expect(error).toMatchObject({
      code: "BAD_REQUEST",
      message: "The player doesn't have enough balance to remove that much",
    });
  });

  it("maps an unknown player to NOT_FOUND", async () => {
    balanceRepo.adminGrant.mockRejectedValue(
      new NotFoundError("Player not found"),
    );

    const error = await rejection(caller.adjust(input));

    expect(error).toMatchObject({
      code: "NOT_FOUND",
      message: "Player not found",
    });
  });
});

describe("admin.players.balance.bulkAdjust", () => {
  const input = {
    playerUuids: [PLAYER_UUID, "cccccccc-cccc-4ccc-8ccc-cccccccccccc"],
    amount: -25,
    reason: "duplication exploit",
  };

  it("passes the signed amount and the admin to the bulk adjustment and summarizes the outcome", async () => {
    bulkAdjust.mockResolvedValue([
      {
        playerUuid: PLAYER_UUID,
        playerUsername: "Steve",
        success: true,
        newBalance: 75,
      },
      {
        playerUuid: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        playerUsername: "Alex",
        success: false,
        error: "Insufficient balance: has 10.000, needs 25.000",
      },
    ]);

    const result = await caller.bulkAdjust(input);

    expect(bulkAdjust).toHaveBeenCalledWith(
      input.playerUuids,
      -25,
      ADMIN.discordId,
      ADMIN.minecraftUsername,
      "duplication exploit",
    );
    expect(result.summary).toEqual({ total: 2, successful: 1, failed: 1 });
  });

  it("trims the reason before it is recorded", async () => {
    bulkAdjust.mockResolvedValue([]);

    await caller.bulkAdjust({ ...input, reason: "  duplication exploit  " });

    expect(bulkAdjust).toHaveBeenCalledWith(
      input.playerUuids,
      -25,
      ADMIN.discordId,
      ADMIN.minecraftUsername,
      "duplication exploit",
    );
  });

  it("refuses a zero adjustment", async () => {
    const error = await rejection(caller.bulkAdjust({ ...input, amount: 0 }));

    expect(error).toMatchObject({
      code: "BAD_REQUEST",
      message: "Amount cannot be zero",
    });
    expect(bulkAdjust).not.toHaveBeenCalled();
  });

  it.each([
    ["a fractional amount", { amount: 2.5 }],
    ["an empty player list", { playerUuids: [] }],
    [
      "more than 100 players",
      { playerUuids: Array.from({ length: 101 }, () => PLAYER_UUID) },
    ],
    ["an empty reason", { reason: "" }],
    ["a whitespace-only reason", { reason: "   " }],
  ])("rejects %s", async (_label, overrides) => {
    const error = await rejection(
      caller.bulkAdjust({ ...input, ...overrides }),
    );

    expect(error.code).toBe("BAD_REQUEST");
    expect(bulkAdjust).not.toHaveBeenCalled();
  });
});
