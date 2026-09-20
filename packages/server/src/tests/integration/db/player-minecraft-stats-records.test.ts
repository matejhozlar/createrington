import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { Q } from "@/db";

const ALICE = "bbbbbbbb-0000-4000-8000-000000000001";
const BOB = "bbbbbbbb-0000-4000-8000-000000000002";
const CARA = "bbbbbbbb-0000-4000-8000-000000000003";
const UUIDS = [ALICE, BOB, CARA];
const DISCORD_IDS = [
  "778000000000000001",
  "778000000000000002",
  "778000000000000003",
];
const SERVER_IDENTIFIERS = ["records-test-a", "records-test-b"];

const stats = Q.player.minecraft.stats;

let serverA: number;
let serverB: number;

async function ensureServer(identifier: string): Promise<number> {
  const existing = await Q.server.find({ identifier });
  if (existing) return existing.id;
  const created = await Q.server.createAndReturn({
    name: identifier,
    identifier,
  });
  return created.id;
}

async function removePlayers(): Promise<void> {
  await Q.player.deleteAll({ minecraftUuid: { $in: UUIDS } });
  await Q.player.deleteAll({ discordId: { $in: DISCORD_IDS } });
}

async function seedStats(
  serverId: number,
  entries: Record<string, Record<string, Record<string, number>>>,
): Promise<void> {
  await stats.batchUpsert(
    serverId,
    Object.entries(entries).map(([minecraftUuid, playerStats]) => ({
      minecraftUuid,
      stats: playerStats,
      dataVersion: null,
    })),
  );
}

async function recordsOf(): Promise<Record<string, number>> {
  const { rows } = await stats.getRecordLeaderboard();
  return Object.fromEntries(
    rows
      .filter((row) => UUIDS.includes(row.minecraftUuid))
      .map((row) => [row.minecraftUsername, row.records]),
  );
}

beforeAll(async () => {
  serverA = await ensureServer(SERVER_IDENTIFIERS[0]);
  serverB = await ensureServer(SERVER_IDENTIFIERS[1]);
});

beforeEach(async () => {
  await removePlayers();
  const names = ["records_alice", "records_bob", "records_cara"];
  for (const [index, minecraftUuid] of UUIDS.entries()) {
    await Q.player.create({
      minecraftUuid,
      minecraftUsername: names[index],
      discordId: DISCORD_IDS[index],
    });
  }
});

afterAll(async () => {
  await removePlayers();
  await Q.server.deleteAll({ identifier: { $in: SERVER_IDENTIFIERS } });
});

describe("PlayerMinecraftStatsQueries.getRecordLeaderboard (integration)", () => {
  it("counts a stat only once two players have a nonzero value for it", async () => {
    const before = await stats.getRecordLeaderboard();

    await seedStats(serverA, {
      [ALICE]: {
        "minecraft:mined": {
          "recordtest:contested": 10,
          "recordtest:solo": 500,
          "recordtest:zeroed": 7,
        },
      },
      [BOB]: {
        "minecraft:mined": {
          "recordtest:contested": 4,
          "recordtest:zeroed": 0,
        },
      },
    });

    const after = await stats.getRecordLeaderboard();

    expect(await recordsOf()).toEqual({ records_alice: 1 });
    expect(after.contestedKeys - before.contestedKeys).toBe(1);
  });

  it("awards every player tied for first at a stat", async () => {
    await seedStats(serverA, {
      [ALICE]: { "minecraft:killed": { "recordtest:tied": 9 } },
      [BOB]: { "minecraft:killed": { "recordtest:tied": 9 } },
      [CARA]: { "minecraft:killed": { "recordtest:tied": 2 } },
    });

    expect(await recordsOf()).toEqual({ records_alice: 1, records_bob: 1 });
  });

  it("sums a stat across servers before ranking", async () => {
    await seedStats(serverA, {
      [ALICE]: { "minecraft:crafted": { "recordtest:summed": 6 } },
      [BOB]: { "minecraft:crafted": { "recordtest:summed": 8 } },
    });
    await seedStats(serverB, {
      [ALICE]: { "minecraft:crafted": { "recordtest:summed": 5 } },
    });

    expect(await recordsOf()).toEqual({ records_alice: 1 });
  });

  it("ignores excluded categories and blocklisted custom stats", async () => {
    const before = await stats.getRecordLeaderboard();

    await seedStats(serverA, {
      [ALICE]: {
        "minecraft:dropped": { "recordtest:excluded": 50 },
        "minecraft:picked_up": { "recordtest:excluded": 50 },
        "minecraft:killed_by": { "recordtest:excluded": 50 },
        "minecraft:custom": {
          "minecraft:play_time": 999999,
          "minecraft:drop": 999999,
          "recordtest:custom_counted": 3,
        },
      },
      [BOB]: {
        "minecraft:dropped": { "recordtest:excluded": 10 },
        "minecraft:picked_up": { "recordtest:excluded": 10 },
        "minecraft:killed_by": { "recordtest:excluded": 10 },
        "minecraft:custom": {
          "minecraft:play_time": 1,
          "minecraft:drop": 1,
          "recordtest:custom_counted": 8,
        },
      },
    });

    const after = await stats.getRecordLeaderboard();

    expect(await recordsOf()).toEqual({ records_bob: 1 });
    expect(after.contestedKeys - before.contestedKeys).toBe(1);
  });

  it("orders by record count and honours the limit", async () => {
    await seedStats(serverA, {
      [ALICE]: {
        "minecraft:used": {
          "recordtest:order_a": 9,
          "recordtest:order_b": 9,
          "recordtest:order_c": 1,
        },
      },
      [BOB]: {
        "minecraft:used": {
          "recordtest:order_a": 1,
          "recordtest:order_b": 1,
          "recordtest:order_c": 9,
        },
      },
    });

    const { rows } = await stats.getRecordLeaderboard();
    const ours = rows.filter((row) => UUIDS.includes(row.minecraftUuid));

    expect(ours.map((row) => [row.minecraftUsername, row.records])).toEqual([
      ["records_alice", 2],
      ["records_bob", 1],
    ]);
    expect(ours[0].discordId).toBe(DISCORD_IDS[0]);

    const limited = await stats.getRecordLeaderboard(1);
    expect(limited.rows).toHaveLength(1);
  });
});
