import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { Q } from "@/db";
import {
  getTestPool,
  truncateTable,
  cleanupTestPool,
} from "@/tests/helpers/db";

const ALICE = "11111111-1111-1111-1111-111111111111";
const BOB = "22222222-2222-2222-2222-222222222222";
const CAROL = "33333333-3333-3333-3333-333333333333";

const warning = Q.player.inactivity.warning;
const exemption = Q.player.inactivity.exemption;

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function seedPlayer(
  uuid: string,
  username: string,
  discordId: string,
  lastSeenDaysAgo: number,
): Promise<void> {
  await Q.player.create({
    minecraftUuid: uuid,
    minecraftUsername: username,
    discordId,
    lastSeen: daysAgo(lastSeenDaysAgo),
    createdAt: daysAgo(365),
  });
}

async function seedWarning(
  uuid: string,
  fields: {
    warnedDaysAgo: number;
    resolvedDaysAgo?: number;
    removedDaysAgo?: number;
  },
): Promise<number> {
  const row = await warning.createAndReturn({
    playerMinecraftUuid: uuid,
    warnedAt: daysAgo(fields.warnedDaysAgo),
    resolvedAt:
      fields.resolvedDaysAgo === undefined
        ? null
        : daysAgo(fields.resolvedDaysAgo),
    removedAt:
      fields.removedDaysAgo === undefined
        ? null
        : daysAgo(fields.removedDaysAgo),
  });
  return row.id;
}

async function seedBan(
  uuid: string,
  fields: {
    bannedDaysAgo: number;
    expiresDaysAgo?: number;
    unbannedDaysAgo?: number;
  },
): Promise<void> {
  await Q.player.ban.create({
    playerMinecraftUuid: uuid,
    banType: fields.expiresDaysAgo === undefined ? "permanent" : "temporary",
    reason: "griefing",
    bannedByDiscordId: "900",
    bannedByUsername: "mod",
    bannedAt: daysAgo(fields.bannedDaysAgo),
    expiresAt:
      fields.expiresDaysAgo === undefined
        ? null
        : daysAgo(fields.expiresDaysAgo),
    ...(fields.unbannedDaysAgo === undefined
      ? {}
      : {
          unbanned: true,
          unbannedByDiscordId: "900",
          unbannedByUsername: "mod",
          unbannedAt: daysAgo(fields.unbannedDaysAgo),
        }),
  });
}

async function exempt(uuid: string, reason?: string): Promise<void> {
  await exemption.create({
    playerMinecraftUuid: uuid,
    reason: reason ?? null,
    createdByDiscordId: "101",
  });
}

beforeAll(async () => {
  await getTestPool().query("SELECT 1");
});

beforeEach(async () => {
  await truncateTable("player");
});

afterAll(async () => {
  await cleanupTestPool();
});

describe("Q.player.inactivity.warning.pruneClosed", () => {
  it("deletes warnings resolved or removed before the retention window", async () => {
    await seedPlayer(ALICE, "alice", "100", 1);
    await seedWarning(ALICE, { warnedDaysAgo: 100, resolvedDaysAgo: 45 });
    await seedWarning(ALICE, { warnedDaysAgo: 100, removedDaysAgo: 31 });
    const recentResolved = await seedWarning(ALICE, {
      warnedDaysAgo: 40,
      resolvedDaysAgo: 10,
    });
    const active = await seedWarning(ALICE, { warnedDaysAgo: 100 });

    expect(await warning.pruneClosed(30)).toBe(2);

    const remaining = (await warning.findAll()).map((w) => w.id).sort();
    expect(remaining).toEqual([recentResolved, active].sort());
  });

  it("returns zero when nothing is past retention", async () => {
    await seedPlayer(ALICE, "alice", "100", 1);
    await seedWarning(ALICE, { warnedDaysAgo: 20, resolvedDaysAgo: 5 });

    expect(await warning.pruneClosed(30)).toBe(0);
    expect(await warning.count()).toBe(1);
  });
});

describe("Q.player.inactivity.warning.countByStatus", () => {
  it("scopes resolved and removed counts to the retention window", async () => {
    await seedPlayer(ALICE, "alice", "100", 90);
    await seedWarning(ALICE, { warnedDaysAgo: 100, resolvedDaysAgo: 45 });
    await seedWarning(ALICE, { warnedDaysAgo: 40, resolvedDaysAgo: 10 });
    await seedWarning(ALICE, { warnedDaysAgo: 40, removedDaysAgo: 5 });
    await seedWarning(ALICE, { warnedDaysAgo: 5 });
    await seedWarning(ALICE, { warnedDaysAgo: 20 });

    expect(await warning.countByStatus(14, 30)).toEqual({
      active: 1,
      expired: 1,
      resolvedInRetention: 1,
      removedInRetention: 1,
    });
  });
});

describe("removed warnings of deleted players", () => {
  async function removePlayer(
    uuid: string,
    username: string,
    discordId: string,
  ): Promise<void> {
    await seedPlayer(uuid, username, discordId, 70);
    const id = await seedWarning(uuid, { warnedDaysAgo: 20 });
    await warning.update(
      { id },
      { removedAt: daysAgo(1), minecraftUsername: username, discordId },
    );
    await Q.player.delete({ minecraftUuid: uuid });
  }

  it("lists each one under its snapshot name once the player row is gone", async () => {
    await removePlayer(ALICE, "alice", "100");
    await removePlayer(BOB, "bob", "101");

    const { rows, total } = await warning.getByStatus({
      status: "removed",
      graceDays: 14,
      limit: 20,
      offset: 0,
    });

    expect(total).toBe(2);
    expect(
      rows
        .map((row) => ({
          uuid: row.playerMinecraftUuid,
          username: row.minecraftUsername,
          discordId: row.discordId,
        }))
        .sort((a, b) => (a.username ?? "").localeCompare(b.username ?? "")),
    ).toEqual([
      { uuid: null, username: "alice", discordId: "100" },
      { uuid: null, username: "bob", discordId: "101" },
    ]);
  });

  it("finds one by its snapshot name and counts it within retention", async () => {
    await removePlayer(ALICE, "alice", "100");
    await removePlayer(BOB, "bob", "101");

    const { rows, total } = await warning.getByStatus({
      status: "removed",
      graceDays: 14,
      search: "LIC",
      limit: 20,
      offset: 0,
    });

    expect(total).toBe(1);
    expect(rows.map((row) => row.minecraftUsername)).toEqual(["alice"]);
    expect(await warning.countByStatus(14, 30)).toMatchObject({
      removedInRetention: 2,
    });
  });
});

describe("Q.player.inactivity.warning.getInactivePlayers", () => {
  it("skips exempted players", async () => {
    await seedPlayer(ALICE, "alice", "100", 90);
    await seedPlayer(BOB, "bob", "101", 90);
    await exempt(BOB);

    const inactive = await warning.getInactivePlayers(60);
    expect(inactive.map((p) => p.minecraftUuid)).toEqual([ALICE]);
  });

  it("skips players under an active temporary or permanent ban", async () => {
    await seedPlayer(ALICE, "alice", "100", 90);
    await seedPlayer(BOB, "bob", "101", 90);
    await seedPlayer(CAROL, "carol", "102", 90);
    await seedBan(BOB, { bannedDaysAgo: 95, expiresDaysAgo: -200 });
    await seedBan(CAROL, { bannedDaysAgo: 95 });

    const inactive = await warning.getInactivePlayers(60);
    expect(inactive.map((p) => p.minecraftUuid)).toEqual([ALICE]);
  });

  it("restarts the inactivity clock when a ban ends", async () => {
    await seedPlayer(ALICE, "alice", "100", 200);
    await seedPlayer(BOB, "bob", "101", 200);
    await seedPlayer(CAROL, "carol", "102", 200);
    await seedBan(ALICE, { bannedDaysAgo: 195, expiresDaysAgo: 70 });
    await seedBan(BOB, { bannedDaysAgo: 195, expiresDaysAgo: 10 });
    await seedBan(CAROL, {
      bannedDaysAgo: 195,
      expiresDaysAgo: -100,
      unbannedDaysAgo: 20,
    });

    const inactive = await warning.getInactivePlayers(60);
    expect(inactive.map((p) => p.minecraftUuid)).toEqual([ALICE]);
  });
});

describe("Q.player.inactivity.warning.getExpiredWarnings", () => {
  it("skips warnings belonging to exempted players", async () => {
    await seedPlayer(ALICE, "alice", "100", 90);
    await seedPlayer(BOB, "bob", "101", 90);
    const aliceWarning = await seedWarning(ALICE, { warnedDaysAgo: 20 });
    await seedWarning(BOB, { warnedDaysAgo: 20 });
    await exempt(BOB);

    const expired = await warning.getExpiredWarnings(14);
    expect(expired.map((w) => w.id)).toEqual([aliceWarning]);
  });

  it("skips warned players who are banned or whose ban ended within the grace period", async () => {
    await seedPlayer(ALICE, "alice", "100", 120);
    await seedPlayer(BOB, "bob", "101", 120);
    await seedPlayer(CAROL, "carol", "102", 120);
    const aliceWarning = await seedWarning(ALICE, { warnedDaysAgo: 60 });
    await seedWarning(BOB, { warnedDaysAgo: 60 });
    await seedWarning(CAROL, { warnedDaysAgo: 60 });
    await seedBan(ALICE, { bannedDaysAgo: 50, expiresDaysAgo: 20 });
    await seedBan(BOB, { bannedDaysAgo: 50, expiresDaysAgo: 5 });
    await seedBan(CAROL, { bannedDaysAgo: 50 });

    const expired = await warning.getExpiredWarnings(14);
    expect(expired.map((w) => w.id)).toEqual([aliceWarning]);
  });
});

describe("Q.player.inactivity.warning.resolveReturned", () => {
  it("resolves the active warnings of players seen since they were warned", async () => {
    await seedPlayer(ALICE, "alice", "100", 5);
    await seedPlayer(BOB, "bob", "101", 90);
    const aliceActive = await seedWarning(ALICE, { warnedDaysAgo: 20 });
    const aliceRemoved = await seedWarning(ALICE, {
      warnedDaysAgo: 100,
      removedDaysAgo: 80,
    });
    const bobActive = await seedWarning(BOB, { warnedDaysAgo: 20 });

    expect(await warning.resolveReturned()).toEqual([
      { id: aliceActive, minecraftUsername: "alice" },
    ]);

    expect(
      (await warning.find({ id: aliceActive }))?.resolvedAt,
    ).not.toBeNull();
    expect((await warning.find({ id: aliceRemoved }))?.resolvedAt).toBeNull();
    expect((await warning.find({ id: bobActive }))?.resolvedAt).toBeNull();
    expect(await warning.resolveReturned()).toEqual([]);
  });
});

describe("Q.player.inactivity.warning.resolveActiveForPlayer", () => {
  it("resolves only the player's active warnings", async () => {
    await seedPlayer(ALICE, "alice", "100", 90);
    await seedPlayer(BOB, "bob", "101", 90);
    const aliceActive = await seedWarning(ALICE, { warnedDaysAgo: 20 });
    const aliceRemoved = await seedWarning(ALICE, {
      warnedDaysAgo: 100,
      removedDaysAgo: 80,
    });
    const bobActive = await seedWarning(BOB, { warnedDaysAgo: 20 });

    expect(await warning.resolveActiveForPlayer(ALICE)).toBe(1);

    expect(
      (await warning.find({ id: aliceActive }))?.resolvedAt,
    ).not.toBeNull();
    expect((await warning.find({ id: aliceRemoved }))?.resolvedAt).toBeNull();
    expect((await warning.find({ id: bobActive }))?.resolvedAt).toBeNull();
  });
});

describe("Q.player.inactivity.exemption.createIfAbsent", () => {
  it("inserts once and reports an existing exemption without throwing", async () => {
    await seedPlayer(ALICE, "alice", "100", 5);
    const data = {
      playerMinecraftUuid: ALICE,
      reason: null,
      createdByDiscordId: "100",
    };

    expect(await exemption.createIfAbsent(data)).toBe(true);
    expect(await exemption.createIfAbsent(data)).toBe(false);
    expect(await exemption.count()).toBe(1);
  });
});

describe("Q.player.inactivity.exemption.getWithPlayer", () => {
  it("joins the exempted player and resolves the creating admin's Minecraft username", async () => {
    await seedPlayer(ALICE, "alice", "100", 5);
    await seedPlayer(BOB, "bob", "101", 5);
    await exempt(ALICE, "long trip");

    const { rows: exemptions, total } = await exemption.getWithPlayer({
      limit: 20,
      offset: 0,
    });

    expect(total).toBe(1);
    expect(exemptions[0]).toMatchObject({
      playerMinecraftUuid: ALICE,
      minecraftUsername: "alice",
      reason: "long trip",
      createdByDiscordId: "101",
      createdByMinecraftUsername: "bob",
    });
  });

  it("keeps the exemption and clears the creator when the creating admin's player row is deleted", async () => {
    await seedPlayer(ALICE, "alice", "100", 5);
    await seedPlayer(BOB, "bob", "101", 5);
    await exempt(ALICE);

    await Q.player.delete({ minecraftUuid: BOB });

    const { rows: exemptions, total } = await exemption.getWithPlayer({
      limit: 20,
      offset: 0,
    });

    expect(total).toBe(1);
    expect(exemptions[0]).toMatchObject({
      playerMinecraftUuid: ALICE,
      createdByDiscordId: null,
      createdByMinecraftUsername: null,
    });
  });

  it("filters by username substring", async () => {
    await seedPlayer(ALICE, "alice", "100", 5);
    await seedPlayer(BOB, "bob", "101", 5);
    await exempt(ALICE);
    await exempt(BOB);

    const { rows: exemptions, total } = await exemption.getWithPlayer({
      search: "LIC",
      limit: 20,
      offset: 0,
    });

    expect(total).toBe(1);
    expect(exemptions.map((e) => e.minecraftUsername)).toEqual(["alice"]);
  });
});
