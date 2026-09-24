import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { Q } from "@/db";

const ALICE = "dddddddd-0000-4000-8000-000000000001";
const BOB = "dddddddd-0000-4000-8000-000000000002";
const UUIDS = [ALICE, BOB];
const DISCORD_IDS = ["779000000000000001", "779000000000000002"];
const SERVER_IDENTIFIERS = ["stat-total-test-a", "stat-total-test-b"];

const stats = Q.player.minecraft.stats;
const totals = Q.player.minecraft.stat.total;

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

function upsert(
  serverId: number,
  entries: Record<string, Record<string, Record<string, unknown>>>,
): Promise<string[]> {
  return stats.batchUpsert(
    serverId,
    Object.entries(entries).map(([minecraftUuid, playerStats]) => ({
      minecraftUuid,
      stats: playerStats,
      dataVersion: null,
    })),
  );
}

async function totalOf(
  minecraftUuid: string,
  category: string,
  item: string,
): Promise<number | null> {
  const key = await Q.player.minecraft.stat.key.find({ category, item });
  if (!key) return null;
  const row = await totals.find({ statKeyId: key.id, minecraftUuid });
  return row ? Number(row.value) : null;
}

beforeAll(async () => {
  serverA = await ensureServer(SERVER_IDENTIFIERS[0]);
  serverB = await ensureServer(SERVER_IDENTIFIERS[1]);
});

beforeEach(async () => {
  await removePlayers();
  for (const [index, minecraftUuid] of UUIDS.entries()) {
    await Q.player.create({
      minecraftUuid,
      minecraftUsername: `stat_total_${index}`,
      discordId: DISCORD_IDS[index],
    });
  }
});

afterAll(async () => {
  await removePlayers();
  await Q.server.deleteAll({ identifier: { $in: SERVER_IDENTIFIERS } });
});

describe("PlayerMinecraftStatTotalQueries projection (integration)", () => {
  it("sums a stat across servers", async () => {
    await upsert(serverA, {
      [ALICE]: { "minecraft:mined": { "totaltest:ore": 7 } },
    });
    await upsert(serverB, {
      [ALICE]: { "minecraft:mined": { "totaltest:ore": 5 } },
    });

    expect(await totalOf(ALICE, "minecraft:mined", "totaltest:ore")).toBe(12);
  });

  it("reports only players whose stats changed", async () => {
    const first = { [ALICE]: { "minecraft:used": { "totaltest:pick": 3 } } };
    expect(await upsert(serverA, first)).toEqual([ALICE]);
    expect(await upsert(serverA, first)).toEqual([]);

    const changed = await upsert(serverA, {
      [ALICE]: { "minecraft:used": { "totaltest:pick": 3 } },
      [BOB]: { "minecraft:used": { "totaltest:pick": 1 } },
    });
    expect(changed).toEqual([BOB]);
  });

  it("drops a total once the stat is gone or back to zero", async () => {
    await upsert(serverA, {
      [ALICE]: {
        "minecraft:crafted": { "totaltest:gear": 4, "totaltest:rod": 2 },
      },
    });
    await upsert(serverA, {
      [ALICE]: { "minecraft:crafted": { "totaltest:gear": 0 } },
    });

    expect(
      await totalOf(ALICE, "minecraft:crafted", "totaltest:gear"),
    ).toBeNull();
    expect(
      await totalOf(ALICE, "minecraft:crafted", "totaltest:rod"),
    ).toBeNull();
  });

  it("skips malformed values instead of failing the import", async () => {
    await upsert(serverA, {
      [ALICE]: {
        "minecraft:mined": { "totaltest:ore": "lots", "totaltest:coal": 9 },
        "minecraft:broken": 3 as unknown as Record<string, unknown>,
      },
    });

    expect(await totalOf(ALICE, "minecraft:mined", "totaltest:coal")).toBe(9);
    expect(await totalOf(ALICE, "minecraft:mined", "totaltest:ore")).toBeNull();
  });

  it("compares an item across categories in the requested order", async () => {
    await upsert(serverA, {
      [ALICE]: {
        "minecraft:mined": { "totaltest:ice": 2 },
        "minecraft:used": { "totaltest:ice": 8 },
      },
      [BOB]: { "minecraft:mined": { "totaltest:ice": 1 } },
    });

    const rows = await totals.compareItem("totaltest:ice", [
      "minecraft:used",
      "minecraft:mined",
    ]);
    const mine = rows.filter((row) => UUIDS.includes(row.minecraftUuid));

    expect(mine).toEqual([
      {
        minecraftUuid: ALICE,
        minecraftUsername: "stat_total_0",
        values: [8, 2],
      },
      {
        minecraftUuid: BOB,
        minecraftUsername: "stat_total_1",
        values: [0, 1],
      },
    ]);
  });

  it("ranks every holder of one stat, highest first", async () => {
    await upsert(serverA, {
      [ALICE]: { "minecraft:mined": { "totaltest:quartz": 3 } },
      [BOB]: { "minecraft:mined": { "totaltest:quartz": 11 } },
    });

    const rows = await totals.getStatRanking(
      "minecraft:mined",
      "totaltest:quartz",
    );

    expect(rows.map((row) => [row.minecraftUuid, row.value])).toEqual([
      [BOB, 11],
      [ALICE, 3],
    ]);
  });

  it("lists the contested records a player holds with the runner-up", async () => {
    await upsert(serverA, {
      [ALICE]: {
        "minecraft:mined": { "totaltest:lead": 9, "totaltest:solo": 5 },
        "minecraft:dropped": { "totaltest:lead": 50 },
      },
      [BOB]: {
        "minecraft:mined": { "totaltest:lead": 4 },
        "minecraft:dropped": { "totaltest:lead": 1 },
      },
    });

    const held = await totals.getRecordsHeld(ALICE);
    const mine = held.filter((record) => record.item.startsWith("totaltest:"));

    expect(mine).toEqual([
      {
        category: "minecraft:mined",
        item: "totaltest:lead",
        value: 9,
        holders: 2,
        runnerUp: 4,
      },
    ]);
    expect(
      (await totals.getRecordsHeld(BOB)).filter((record) =>
        record.item.startsWith("totaltest:"),
      ),
    ).toEqual([]);
  });

  it("searches stats per category with holder counts", async () => {
    await upsert(serverA, {
      [ALICE]: {
        "minecraft:mined": { "totaltest:search_rock": 2 },
        "minecraft:used": { "totaltest:search_rock": 1 },
      },
      [BOB]: { "minecraft:mined": { "totaltest:search_rock": 6 } },
    });

    expect(
      await Q.player.minecraft.stat.key.searchStats("search rock"),
    ).toEqual([
      {
        category: "minecraft:mined",
        item: "totaltest:search_rock",
        holders: 2,
      },
      { category: "minecraft:used", item: "totaltest:search_rock", holders: 1 },
    ]);
  });

  it("matches the item name, and a mod namespace only for modded items", async () => {
    await upsert(serverA, {
      [ALICE]: {
        "minecraft:mined": {
          "minecraft:totaltest_quarry": 2,
          "totaltestmod:gizmo": 1,
        },
      },
    });

    const byVanillaNamespace = await Q.player.minecraft.stat.key.searchStats(
      "minecraft",
      100,
    );
    const byName = await Q.player.minecraft.stat.key.searchStats("totaltest_q");
    const byModNamespace =
      await Q.player.minecraft.stat.key.searchStats("totaltestmod");

    expect(byVanillaNamespace.map((stat) => stat.item)).not.toContain(
      "minecraft:totaltest_quarry",
    );
    expect(byName.map((stat) => stat.item)).toEqual([
      "minecraft:totaltest_quarry",
    ]);
    expect(byModNamespace.map((stat) => stat.item)).toEqual([
      "totaltestmod:gizmo",
    ]);
  });
});
