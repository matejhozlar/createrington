import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { Q } from "@/db";
import {
  getTestPool,
  truncateTable,
  cleanupTestPool,
} from "@/tests/helpers/db";

const ALICE = "11111111-1111-1111-1111-111111111111";
const BOB = "22222222-2222-2222-2222-222222222222";

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

describe("Q.player.inactivity.warning.findInactivePlayers", () => {
  it("skips exempted players", async () => {
    await seedPlayer(ALICE, "alice", "100", 90);
    await seedPlayer(BOB, "bob", "101", 90);
    await exempt(BOB);

    const inactive = await warning.findInactivePlayers(60);
    expect(inactive.map((p) => p.minecraftUuid)).toEqual([ALICE]);
  });
});

describe("Q.player.inactivity.warning.findExpiredWarnings", () => {
  it("skips warnings belonging to exempted players", async () => {
    await seedPlayer(ALICE, "alice", "100", 90);
    await seedPlayer(BOB, "bob", "101", 90);
    const aliceWarning = await seedWarning(ALICE, { warnedDaysAgo: 20 });
    await seedWarning(BOB, { warnedDaysAgo: 20 });
    await exempt(BOB);

    const expired = await warning.findExpiredWarnings(14);
    expect(expired.map((w) => w.id)).toEqual([aliceWarning]);
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

describe("Q.player.inactivity.exemption.listWithPlayer", () => {
  it("joins the exempted player and resolves the creating admin's Minecraft username", async () => {
    await seedPlayer(ALICE, "alice", "100", 5);
    await seedPlayer(BOB, "bob", "101", 5);
    await exempt(ALICE, "long trip");

    const { exemptions, total } = await exemption.listWithPlayer({
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

    const { exemptions, total } = await exemption.listWithPlayer({
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

    const { exemptions, total } = await exemption.listWithPlayer({
      search: "LIC",
      limit: 20,
      offset: 0,
    });

    expect(total).toBe(1);
    expect(exemptions.map((e) => e.minecraftUsername)).toEqual(["alice"]);
  });
});
