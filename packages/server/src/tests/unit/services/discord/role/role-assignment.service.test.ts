import { describe, it, expect, vi, beforeEach } from "vitest";
import { Collection } from "discord.js";

interface FakeMember {
  id: string;
  user: { username: string };
  roleIds: Set<string>;
}

interface SummaryRow {
  playerMinecraftUuid: string;
  serverId: number;
  totalSeconds: bigint;
}

const db = vi.hoisted(() => ({
  players: vi.fn(),
  summaries: vi.fn(),
}));

vi.mock("@/db", () => ({
  Q: {
    player: {
      findAll: db.players,
      playtime: { summary: { findAll: db.summaries } },
    },
  },
}));

vi.mock("@/services/discord/role/role-notification.service", () => ({
  roleNotificationService: { sendNotification: async () => undefined },
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
import type { Player } from "@createrington/shared/db";
import { RoleAssignmentService } from "@/services/discord/role/role-assignment.service";
import {
  RoleCheckInterval,
  RoleConditionType,
  type AnyRoleRule,
} from "@/services/discord/role/types";
import { resetGuildMemberFetchCache } from "@/discord/utils/guild-members";

const HOUR = 3600;
const DAY_MS = 24 * 60 * 60 * 1000;

const ALICE = "900000000000000101";
const BOB = "900000000000000102";

function playtimeRule(
  roleId: string,
  hours: number,
  serverId?: number,
): AnyRoleRule {
  return {
    roleId,
    label: roleId,
    checkInterval: RoleCheckInterval.REALTIME,
    conditionType: RoleConditionType.PLAYTIME,
    requiredSeconds: hours * HOUR,
    serverId,
  } as AnyRoleRule;
}

function serverAgeRule(roleId: string, days: number): AnyRoleRule {
  return {
    roleId,
    label: roleId,
    checkInterval: RoleCheckInterval.DAILY,
    conditionType: RoleConditionType.SERVER_AGE,
    requiredDays: days,
  } as AnyRoleRule;
}

const PLAYTIME_TIERS = [
  playtimeRule("tier-10", 10),
  playtimeRule("tier-50", 50),
  playtimeRule("tier-100", 100),
];

function player(discordId: string, daysOld = 0): Player {
  return {
    discordId,
    minecraftUuid: `uuid-${discordId}`,
    createdAt: new Date(Date.now() - daysOld * DAY_MS),
  } as Player;
}

function summary(discordId: string, serverId: number, hours: number) {
  return {
    playerMinecraftUuid: `uuid-${discordId}`,
    serverId,
    totalSeconds: BigInt(hours * HOUR),
  } satisfies SummaryRow;
}

const guildMembers = new Collection<string, FakeMember>();
const cache = new Collection<string, FakeMember>();
const singleFetch = vi.fn();

function member(id: string, roleIds: string[] = []): FakeMember {
  const entry = { id, user: { username: id }, roleIds: new Set(roleIds) };
  guildMembers.set(id, entry);
  return entry;
}

function createService(): RoleAssignmentService {
  const client = {
    guilds: {
      fetch: async () => ({
        id: "guild",
        members: {
          cache,
          fetch: async (id?: string) => {
            if (id) {
              singleFetch(id);
              const entry = guildMembers.get(id);
              if (!entry) throw new Error("Unknown Member");
              return entry;
            }
            for (const [key, entry] of guildMembers) cache.set(key, entry);
            return cache;
          },
        },
      }),
    },
  } as unknown as Client;

  return new RoleAssignmentService(client);
}

beforeEach(() => {
  guildMembers.clear();
  cache.clear();
  singleFetch.mockReset();
  db.players.mockReset();
  db.summaries.mockReset();
  resetGuildMemberFetchCache();
});

describe("RoleAssignmentService.processRoleHierarchy", () => {
  it("reads playtime once for the whole hierarchy and keeps only the highest tier", async () => {
    const alice = member(ALICE, ["tier-10"]);
    db.summaries.mockResolvedValue([
      summary(ALICE, 1, 40),
      summary(ALICE, 2, 20),
    ]);

    const result = await createService().processRoleHierarchy(
      player(ALICE),
      PLAYTIME_TIERS,
    );

    expect(db.summaries).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ success: true, assigned: true });
    expect([...alice.roleIds]).toEqual(["tier-50"]);
  });

  it("counts only the rule's server when the rule names one", async () => {
    const alice = member(ALICE);
    db.summaries.mockResolvedValue([
      summary(ALICE, 1, 5),
      summary(ALICE, 2, 30),
    ]);

    await createService().processRoleHierarchy(player(ALICE), [
      playtimeRule("server-1", 10, 1),
    ]);

    expect(alice.roleIds.has("server-1")).toBe(false);
  });

  it("evaluates server age from the player row without reading playtime", async () => {
    const alice = member(ALICE);

    await createService().processRoleHierarchy(player(ALICE, 45), [
      serverAgeRule("age-30", 30),
      serverAgeRule("age-60", 60),
    ]);

    expect(db.summaries).not.toHaveBeenCalled();
    expect([...alice.roleIds]).toEqual(["age-30"]);
  });
});

describe("RoleAssignmentService.processAllPlayers", () => {
  it("loads playtime once and never fetches members one by one", async () => {
    const alice = member(ALICE);
    const bob = member(BOB, ["tier-100"]);
    db.players.mockResolvedValue([player(ALICE), player(BOB)]);
    db.summaries.mockResolvedValue([
      summary(ALICE, 1, 120),
      summary(BOB, 1, 12),
    ]);

    const results = await createService().processAllPlayers([PLAYTIME_TIERS]);

    expect(db.summaries).toHaveBeenCalledTimes(1);
    expect(singleFetch).not.toHaveBeenCalled();
    expect(results).toHaveLength(2);
    expect([...alice.roleIds]).toEqual(["tier-100"]);
    expect([...bob.roleIds]).toEqual(["tier-10"]);
  });

  it("skips players who are not in the guild", async () => {
    member(ALICE);
    db.players.mockResolvedValue([player(ALICE, 90), player(BOB, 90)]);

    const results = await createService().processAllPlayers([
      [serverAgeRule("age-30", 30)],
    ]);

    expect(results.map((r) => r.discordId)).toEqual([ALICE]);
    expect(db.summaries).not.toHaveBeenCalled();
  });

  it("reconciles every hierarchy against the same player context", async () => {
    const alice = member(ALICE);
    db.players.mockResolvedValue([player(ALICE, 45)]);
    db.summaries.mockResolvedValue([summary(ALICE, 1, 60)]);

    const results = await createService().processAllPlayers([
      PLAYTIME_TIERS,
      [serverAgeRule("age-30", 30)],
    ]);

    expect(results).toHaveLength(2);
    expect([...alice.roleIds].sort()).toEqual(["age-30", "tier-50"]);
  });
});
