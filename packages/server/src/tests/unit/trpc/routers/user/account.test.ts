import { describe, it, expect, vi } from "vitest";

const { sessionRow, transactionRow, banRow, strikeRow, ticketRow, Q } =
  vi.hoisted(() => {
    const empty = () => vi.fn().mockResolvedValue([]);
    const sessionRow = {
      id: 4,
      discord_id: "100000000000000001",
      token_hash: "f".repeat(64),
      family_id: "0f6a7b1c-5d4e-4f3a-9b2c-1d0e9f8a7b6c",
      ip_address: "203.0.113.7",
      user_agent: "Firefox",
      created_at: new Date("2026-01-04T00:00:00Z"),
      last_used_at: new Date("2026-01-05T00:00:00Z"),
      expires_at: new Date("2026-02-04T00:00:00Z"),
      revoked_at: null,
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

vi.mock("@/services/discord/oauth/oauth.service", async () => ({
  AuthRole: (
    await vi.importActual<typeof import("@createrington/shared/auth")>(
      "@createrington/shared/auth",
    )
  ).AuthRole,
}));

vi.mock("@/services/auth/admin-status/admin-status.service", () => ({
  adminStatusService: { isAdmin: vi.fn() },
}));

vi.mock("@/services/player/deletion", () => ({ playerDeletionService: {} }));

vi.mock("@/services", () => ({ getService: vi.fn(), Services: {} }));

import { accountRouter } from "@/trpc/routers/user/account";
import { AuthRole } from "@createrington/shared/auth";
import type { Context } from "@/trpc/context";

function callerFor(discordId: string) {
  return accountRouter.createCaller({
    user: {
      discordId,
      minecraftUuid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      role: AuthRole.USER,
      isAdmin: false,
    },
    service: null,
    ip: "127.0.0.1",
  } as unknown as Context);
}

describe("user.account.exportData", () => {
  it("exports sessions, transactions, bans, strikes and tickets without secrets, staff identities or internal metadata", async () => {
    const data = await callerFor("100000000000000001").exportData();

    expect(data.sessions).toEqual([
      {
        id: sessionRow.id,
        ipAddress: sessionRow.ip_address,
        userAgent: sessionRow.user_agent,
        createdAt: sessionRow.created_at.toISOString(),
        lastUsedAt: sessionRow.last_used_at.toISOString(),
        expiresAt: sessionRow.expires_at.toISOString(),
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

    expect(data.moderation.bans).toEqual([
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
    expect(data.moderation.strikes).toEqual([
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
