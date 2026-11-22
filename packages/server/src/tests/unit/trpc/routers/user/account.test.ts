import { describe, it, expect, vi, beforeEach } from "vitest";

const { sessionRow, transactionRow, banRow, strikeRow, ticketRow, Q } =
  vi.hoisted(() => {
    const empty = () => vi.fn().mockResolvedValue([]);
    const sessionRow = {
      id: 4,
      discordId: "100000000000000001",
      tokenHash: "f".repeat(64),
      familyId: "0f6a7b1c-5d4e-4f3a-9b2c-1d0e9f8a7b6c",
      ipAddress: "203.0.113.7",
      userAgent: "Firefox",
      createdAt: new Date("2026-01-04T00:00:00Z"),
      lastUsedAt: new Date("2026-01-05T00:00:00Z"),
      expiresAt: new Date("2026-02-04T00:00:00Z"),
      revokedAt: null,
    };
    const transactionRow = {
      id: 5,
      amount: 5000n,
      balanceBefore: 0n,
      balanceAfter: 5000n,
      transactionType: "admin_grant",
      description: "compensation",
      relatedPlayerUuid: null,
      metadata: {
        adminDiscordId: "100000000000000009",
        adminUsername: "admin",
      },
      createdAt: new Date("2026-01-06T00:00:00Z"),
    };
    const banRow = {
      id: 1,
      reason: "griefing",
      bannedByDiscordId: "100000000000000009",
      bannedByUsername: "admin",
      bannedAt: new Date("2026-01-01T00:00:00Z"),
      expiresAt: null,
      unbanned: true,
      unbannedByDiscordId: "100000000000000009",
      unbannedByUsername: "admin",
      unbannedAt: new Date("2026-01-02T00:00:00Z"),
      unbanReason: "appeal accepted",
      metadata: { note: "internal" },
    };
    const strikeRow = {
      id: 2,
      description: "spam",
      severity: 1,
      issuedByDiscordId: "100000000000000009",
      issuedByUsername: "admin",
      issuedAt: new Date("2026-01-01T00:00:00Z"),
      removed: false,
      removedByDiscordId: null,
      removedByUsername: null,
      removedAt: null,
      removalReason: null,
      metadata: { note: "internal" },
    };
    const ticketRow = {
      id: 3,
      ticketNumber: 7,
      creatorDiscordId: "100000000000000001",
      closedAt: new Date("2026-01-03T00:00:00Z"),
      closedByDiscordId: "100000000000000009",
      metadata: { transcriptPath: "/srv/transcripts/7.html" },
    };
    return {
      sessionRow,
      transactionRow,
      banRow,
      strikeRow,
      ticketRow,
      Q: {
        player: {
          find: vi.fn().mockResolvedValue(null),
          balance: {
            find: vi.fn().mockResolvedValue(null),
            transaction: {
              findAll: vi.fn().mockResolvedValue([transactionRow]),
            },
          },
          session: { findAll: empty() },
          playtime: {
            daily: { findAll: empty() },
            hourly: { findAll: empty() },
            summary: { findAll: empty() },
          },
          minecraft: { stats: { findAll: empty() } },
          ban: { findAll: vi.fn().mockResolvedValue([banRow]) },
          strike: { findAll: vi.fn().mockResolvedValue([strikeRow]) },
        },
        auth: {
          session: {
            getActiveSessions: vi.fn().mockResolvedValue([sessionRow]),
          },
        },
        reward: { claim: { findAll: empty() } },
        ticket: { findAll: vi.fn().mockResolvedValue([ticketRow]) },
      },
    };
  });

vi.mock("@/db", () => ({ Q }));

vi.mock("@/services/auth/admin-status/admin-status.service", () => ({
  adminStatusService: { isAdmin: vi.fn() },
}));

const { deletePlayer, fetchGuildMember } = vi.hoisted(() => ({
  deletePlayer: vi.fn(),
  fetchGuildMember: vi.fn(),
}));

vi.mock("@/services/player/deletion", () => ({
  playerDeletionService: { delete: deletePlayer },
}));

vi.mock("@/discord/utils/fetch-guild-member", () => ({ fetchGuildMember }));

vi.mock("@/services", () => ({ getService: vi.fn(), Services: {} }));

import { accountRouter } from "@/trpc/routers/user/account";
import { userContext } from "@/tests/helpers/trpc";

function callerFor(discordId: string) {
  return accountRouter.createCaller(userContext({ discordId }));
}

describe("user.account.exportData", () => {
  it("exports sessions, transactions, bans, strikes and tickets without secrets, staff identities or internal metadata", async () => {
    const data = await callerFor("100000000000000001").exportData();
    const moderation = data.moderation as { bans: unknown; strikes: unknown };

    expect(data.sessions).toEqual([
      {
        id: sessionRow.id,
        ipAddress: sessionRow.ipAddress,
        userAgent: sessionRow.userAgent,
        createdAt: sessionRow.createdAt.toISOString(),
        lastUsedAt: sessionRow.lastUsedAt.toISOString(),
        expiresAt: sessionRow.expiresAt.toISOString(),
      },
    ]);
    expect(data.balanceTransactions).toEqual([
      {
        id: transactionRow.id,
        amount: "5000",
        balanceBefore: "0",
        balanceAfter: "5000",
        transactionType: transactionRow.transactionType,
        description: transactionRow.description,
        relatedPlayerUuid: null,
        createdAt: transactionRow.createdAt.toISOString(),
      },
    ]);

    expect(moderation.bans).toEqual([
      {
        id: banRow.id,
        reason: banRow.reason,
        bannedAt: banRow.bannedAt.toISOString(),
        expiresAt: null,
        unbanned: true,
        unbannedAt: banRow.unbannedAt.toISOString(),
        unbanReason: banRow.unbanReason,
      },
    ]);
    expect(moderation.strikes).toEqual([
      {
        id: strikeRow.id,
        description: strikeRow.description,
        severity: strikeRow.severity,
        issuedAt: strikeRow.issuedAt.toISOString(),
        removed: false,
        removedAt: null,
        removalReason: null,
      },
    ]);
    expect(data.tickets).toEqual([
      {
        id: ticketRow.id,
        ticketNumber: ticketRow.ticketNumber,
        creatorDiscordId: ticketRow.creatorDiscordId,
        closedAt: ticketRow.closedAt.toISOString(),
      },
    ]);
  });

  it("allows three exports per user per hour", async () => {
    const caller = callerFor("100000000000000002");

    for (let i = 0; i < 3; i++) {
      await expect(caller.exportData()).resolves.toBeDefined();
    }

    await expect(caller.exportData()).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
    await expect(
      callerFor("100000000000000003").exportData(),
    ).resolves.toBeDefined();
  });
});

describe("user.account.deleteAccount", () => {
  const discordId = "100000000000000004";
  const confirmation = "DELETE MY ACCOUNT";
  const kick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    Q.player.find.mockResolvedValue({ discordId, minecraftUsername: "steve" });
    fetchGuildMember.mockResolvedValue({ kick });
  });

  it("deletes the player with their tickets as the user, then kicks them from Discord", async () => {
    const tx = { ticket: { deleteAll: vi.fn() } };
    deletePlayer.mockImplementationOnce(
      async (
        _id: unknown,
        options: { beforeDelete: (tx: unknown) => Promise<void> },
      ) => {
        await options.beforeDelete(tx);
      },
    );

    await callerFor(discordId).deleteAccount({ confirmation });

    expect(deletePlayer).toHaveBeenCalledWith(
      { discordId },
      expect.objectContaining({
        actor: { type: "user", discordId, username: "steve" },
      }),
    );
    expect(tx.ticket.deleteAll).toHaveBeenCalledWith({
      creatorDiscordId: discordId,
    });
    expect(kick).toHaveBeenCalledWith("Account deleted by user");
  });

  it("still succeeds when the Discord kick fails", async () => {
    kick.mockRejectedValueOnce(new Error("missing permissions"));

    await expect(
      callerFor(discordId).deleteAccount({ confirmation }),
    ).resolves.toBeUndefined();
    expect(deletePlayer).toHaveBeenCalled();
  });

  it("answers NOT_FOUND for a user without a player", async () => {
    Q.player.find.mockResolvedValue(null);

    await expect(
      callerFor(discordId).deleteAccount({ confirmation }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", message: "Player not found" });
    expect(deletePlayer).not.toHaveBeenCalled();
  });

  it("refuses without the confirmation phrase", async () => {
    await expect(
      callerFor(discordId).deleteAccount({ confirmation: "delete" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(deletePlayer).not.toHaveBeenCalled();
  });
});
