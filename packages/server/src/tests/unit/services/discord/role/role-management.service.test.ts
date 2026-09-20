import { describe, it, expect, vi, beforeEach } from "vitest";
import { Collection } from "discord.js";

interface FakeMember {
  id: string;
  user: { tag: string };
  roleIds: Set<string>;
}

interface RecordRow {
  minecraftUuid: string;
  minecraftUsername: string;
  discordId: string;
  records: number;
}

const db = vi.hoisted(() => ({
  records: vi.fn<() => Promise<{ rows: RecordRow[]; contestedKeys: number }>>(),
  playtime: vi.fn(),
  playerFind: vi.fn(),
}));
const netWorth = vi.hoisted(() => ({ rank: vi.fn() }));
const notifications = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock("@/db", () => ({
  Q: {
    player: {
      find: db.playerFind,
      getAll: async () => [],
      balance: { getAllBalances: async () => [] },
      playtime: { summary: { getGlobalLeaderboard: db.playtime } },
      minecraft: { stats: { getRecordLeaderboard: db.records } },
    },
  },
}));

vi.mock("@/services/discord/leaderboard/networth", () => ({
  rankNetWorth: netWorth.rank,
}));

vi.mock("@/services/discord/role/role-notification.service", () => ({
  roleNotificationService: { sendNotification: notifications.send },
}));

vi.mock("@/services/discord/role/role-assignment.service", () => ({
  RoleAssignmentService: class {},
}));

vi.mock("@/services/discord/role/game-rank-sync.service", () => ({
  GameRankSyncService: class {},
}));

vi.mock("@/discord/utils/roles/role-manager", () => ({
  RoleManager: {
    has: (member: FakeMember, roleId: string) => member.roleIds.has(roleId),
    assign: async (member: FakeMember, roleId: string) => {
      member.roleIds.add(roleId);
      return true;
    },
    remove: async (member: FakeMember, roleId: string) => {
      member.roleIds.delete(roleId);
      return true;
    },
    colorOf: () => 0,
  },
}));

import type { Client } from "discord.js";
import { Discord } from "@/discord/constants";
import type { GameRankSyncService } from "@/services/discord/role/game-rank-sync.service";
import { RoleManagementService } from "@/services/discord/role/role-management.service";

const ALICE = "900000000000000101";
const BOB = "900000000000000102";

const members = new Collection<string, FakeMember>();
const gameRankSync = {
  revoke: vi.fn(async () => new Set<string>()),
  grant: vi.fn(async () => undefined),
};

function member(id: string, roleIds: string[] = []): FakeMember {
  const entry = { id, user: { tag: `${id}#0` }, roleIds: new Set(roleIds) };
  members.set(id, entry);
  return entry;
}

function row(discordId: string, username: string, records: number): RecordRow {
  return {
    minecraftUuid: `uuid-${username}`,
    minecraftUsername: username,
    discordId,
    records,
  };
}

function createService(): RoleManagementService {
  const client = {
    guilds: {
      fetch: async () => ({
        members: {
          cache: members,
          fetch: async (id: string) => members.get(id),
        },
      }),
    },
  } as unknown as Client;

  return new RoleManagementService(
    client,
    0,
    gameRankSync as unknown as GameRankSyncService,
  );
}

beforeEach(() => {
  members.clear();
  vi.clearAllMocks();
  notifications.send.mockResolvedValue(undefined);
  db.playtime.mockResolvedValue([]);
  db.playerFind.mockResolvedValue(null);
  netWorth.rank.mockReturnValue([]);
  db.records.mockResolvedValue({ rows: [], contestedKeys: 0 });
});

describe("RoleManagementService.recalculateTopRoles", () => {
  it("keeps the incumbent when the record total is tied", async () => {
    member(ALICE);
    const bob = member(BOB, [Discord.Roles.THE_UNRIVALED]);
    db.records.mockResolvedValue({
      rows: [row(ALICE, "alice", 40), row(BOB, "bob", 40)],
      contestedKeys: 120,
    });

    const [result] = await createService().recalculateTopRoles([
      Discord.Roles.THE_UNRIVALED,
    ]);

    expect(result).toMatchObject({
      holder: "bob",
      assigned: false,
      removed: false,
      failed: false,
    });
    expect(bob.roleIds.has(Discord.Roles.THE_UNRIVALED)).toBe(true);
    expect(notifications.send).not.toHaveBeenCalled();
  });

  it("moves the role to a challenger with strictly more records", async () => {
    const alice = member(ALICE);
    const bob = member(BOB, [Discord.Roles.THE_UNRIVALED]);
    db.records.mockResolvedValue({
      rows: [row(ALICE, "alice", 41), row(BOB, "bob", 40)],
      contestedKeys: 120,
    });

    const [result] = await createService().recalculateTopRoles([
      Discord.Roles.THE_UNRIVALED,
    ]);

    expect(result).toMatchObject({
      holder: "alice",
      assigned: true,
      removed: true,
      failed: false,
    });
    expect(alice.roleIds.has(Discord.Roles.THE_UNRIVALED)).toBe(true);
    expect(bob.roleIds.has(Discord.Roles.THE_UNRIVALED)).toBe(false);
    expect(gameRankSync.grant).toHaveBeenCalledWith(
      expect.objectContaining({ gameRankId: "the_unrivaled" }),
      "alice",
    );
    expect(notifications.send).toHaveBeenCalledWith(
      expect.objectContaining({ discordId: ALICE, currentValue: 41 }),
    );
  });

  it("recalculates only the requested role", async () => {
    member(ALICE);
    db.records.mockResolvedValue({
      rows: [row(ALICE, "alice", 3)],
      contestedKeys: 9,
    });

    const results = await createService().recalculateTopRoles([
      Discord.Roles.THE_UNRIVALED,
    ]);

    expect(results.map((result) => result.rule.label)).toEqual([
      "The Unrivaled",
    ]);
    expect(db.playtime).not.toHaveBeenCalled();
    expect(netWorth.rank).not.toHaveBeenCalled();
  });

  it("recalculates every top role when none is named", async () => {
    const results = await createService().recalculateTopRoles();

    expect(results.map((result) => result.rule.label)).toEqual([
      "The Sleepless",
      "Capitalist",
      "The Unrivaled",
    ]);
    expect(results.every((result) => result.holder === null)).toBe(true);
    expect(results.some((result) => result.failed)).toBe(false);
  });

  it("reports a role whose leaderboard could not be read as failed", async () => {
    db.records.mockRejectedValue(new Error("connection lost"));

    const [result] = await createService().recalculateTopRoles([
      Discord.Roles.THE_UNRIVALED,
    ]);

    expect(result).toMatchObject({ holder: null, failed: true });
  });
});
