import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { Q } from "@/db";

const CLEAN = "aaaa0000-0000-4000-8000-000000000001";
const STRUCK = "aaaa0000-0000-4000-8000-000000000002";
const BANNED = "aaaa0000-0000-4000-8000-000000000003";
const BOTH = "aaaa0000-0000-4000-8000-000000000004";
const UUIDS = [CLEAN, STRUCK, BANNED, BOTH];

const DAY = 24 * 60 * 60 * 1000;
const ADMIN = { issuedByDiscordId: "1", issuedByUsername: "admin" };
const BANNER = { bannedByDiscordId: "1", bannedByUsername: "admin" };
const REMOVED = {
  removed: true,
  removedByDiscordId: "1",
  removedByUsername: "admin",
  removedAt: new Date(),
  removalReason: "appeal",
};
const UNBANNED = {
  unbanned: true,
  unbannedByDiscordId: "1",
  unbannedByUsername: "admin",
  unbannedAt: new Date(),
  unbanReason: "appeal",
};

async function seedPlayers(): Promise<void> {
  for (const [index, minecraftUuid] of UUIDS.entries()) {
    await Q.player.create({
      minecraftUuid,
      minecraftUsername: `violation_${index}`,
      discordId: `778100000000000${index}`,
    });
  }
}

async function removePlayers(): Promise<void> {
  await Q.player.deleteAll({ minecraftUuid: { $in: UUIDS } });
}

beforeAll(async () => {
  await removePlayers();
});

beforeEach(async () => {
  await removePlayers();
  await seedPlayers();
  await Q.player.strike.createMany([
    {
      playerMinecraftUuid: STRUCK,
      classification: "griefing",
      severity: 2,
      description: "active",
      ...ADMIN,
    },
    {
      playerMinecraftUuid: BOTH,
      classification: "pvp",
      severity: 1,
      description: "active",
      ...ADMIN,
    },
    {
      playerMinecraftUuid: BANNED,
      classification: "theft",
      severity: 3,
      description: "lifted",
      ...REMOVED,
      ...ADMIN,
    },
  ]);
  await Q.player.ban.createMany([
    {
      playerMinecraftUuid: BANNED,
      banType: "permanent",
      reason: "active",
      ...BANNER,
    },
    {
      playerMinecraftUuid: BOTH,
      banType: "temporary",
      reason: "active",
      expiresAt: new Date(Date.now() + DAY),
      ...BANNER,
    },
    {
      playerMinecraftUuid: STRUCK,
      banType: "temporary",
      reason: "expired",
      bannedAt: new Date(Date.now() - 2 * DAY),
      expiresAt: new Date(Date.now() - DAY),
      ...BANNER,
    },
  ]);
});

afterAll(async () => {
  await removePlayers();
});

const usernames = (rows: Array<{ minecraftUuid: string }>) =>
  rows.map((row) => UUIDS.indexOf(row.minecraftUuid)).sort();

describe("Q.player.listWithViolations", () => {
  const page = {
    limit: 10,
    offset: 0,
    orderBy: "createdAt",
    orderDirection: "asc",
  } as const;
  const filters = { minecraftUuid: { $in: UUIDS } };

  it("keeps only players with an active strike", async () => {
    const { rows, total } = await Q.player.listWithViolations(
      filters,
      "strikes",
      page,
    );
    expect(usernames(rows)).toEqual([1, 3]);
    expect(total).toBe(2);
  });

  it("ignores lifted strikes and expired bans", async () => {
    const { rows } = await Q.player.listWithViolations(filters, "bans", page);
    expect(usernames(rows)).toEqual([2, 3]);
  });

  it("intersects and unions the two violation kinds", async () => {
    expect(
      usernames(
        (await Q.player.listWithViolations(filters, "both", page)).rows,
      ),
    ).toEqual([3]);
    expect(
      usernames(
        (await Q.player.listWithViolations(filters, "either", page)).rows,
      ),
    ).toEqual([1, 2, 3]);
  });

  it("applies the other filters, the order and the page", async () => {
    const first = await Q.player.listWithViolations(
      {
        minecraftUuid: { $in: UUIDS },
        minecraftUsername: { $ilike: "%violation_%" },
      },
      "either",
      {
        ...page,
        limit: 2,
        orderBy: "minecraftUsername",
        orderDirection: "desc",
      },
    );
    expect(first.rows.map((row) => row.minecraftUsername)).toEqual([
      "violation_3",
      "violation_2",
    ]);
    expect(first.total).toBe(3);

    const second = await Q.player.listWithViolations(
      { minecraftUuid: { $in: UUIDS } },
      "either",
      {
        ...page,
        limit: 2,
        offset: 2,
        orderBy: "minecraftUsername",
        orderDirection: "desc",
      },
    );
    expect(second.rows.map((row) => row.minecraftUsername)).toEqual([
      "violation_1",
    ]);
  });
});

describe("Q.player.strike.getPlayerStatistics", () => {
  it("counts totals, status, classification and severity with the latest issue date", async () => {
    await Q.player.strike.create({
      playerMinecraftUuid: STRUCK,
      classification: "griefing",
      severity: 4,
      description: "older",
      issuedAt: new Date(Date.now() - 10 * DAY),
      ...REMOVED,
      ...ADMIN,
    });

    const stats = await Q.player.strike.getPlayerStatistics(STRUCK);

    expect(stats).toMatchObject({
      total: 2,
      active: 1,
      removed: 1,
      byClassification: expect.objectContaining({ griefing: 2, pvp: 0 }),
      bySeverity: expect.objectContaining({ 2: 1, 4: 1, 1: 0 }),
    });
    expect(stats.mostRecent!.getTime()).toBeGreaterThan(Date.now() - DAY);
    expect(await Q.player.strike.getPlayerStatistics(CLEAN)).toMatchObject({
      total: 0,
      active: 0,
      removed: 0,
    });
    expect(
      (await Q.player.strike.getPlayerStatistics(CLEAN)).mostRecent,
    ).toBeUndefined();
  });
});

describe("Q.player.ban.getPlayerStatistics", () => {
  it("splits bans by type and by active, expired and unbanned", async () => {
    await Q.player.ban.create({
      playerMinecraftUuid: STRUCK,
      banType: "permanent",
      reason: "lifted",
      ...UNBANNED,
      ...BANNER,
    });

    expect(await Q.player.ban.getPlayerStatistics(STRUCK)).toEqual({
      total: 2,
      active: 0,
      unbanned: 1,
      temporary: 1,
      permanent: 1,
      expired: 1,
    });
    expect(await Q.player.ban.getPlayerStatistics(BOTH)).toEqual({
      total: 1,
      active: 1,
      unbanned: 0,
      temporary: 1,
      permanent: 0,
      expired: 0,
    });
    expect(await Q.player.ban.getPlayerStatistics(CLEAN)).toEqual({
      total: 0,
      active: 0,
      unbanned: 0,
      temporary: 0,
      permanent: 0,
      expired: 0,
    });
  });
});
