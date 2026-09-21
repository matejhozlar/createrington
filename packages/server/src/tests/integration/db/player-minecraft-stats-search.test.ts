import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { Q } from "@/db";

const ALICE = "cccccccc-0000-4000-8000-000000000001";
const BOB = "cccccccc-0000-4000-8000-000000000002";
const CARA = "cccccccc-0000-4000-8000-000000000003";
const UUIDS = [ALICE, BOB, CARA];
const DISCORD_IDS = [
  "779000000000000001",
  "779000000000000002",
  "779000000000000003",
];
const SERVER_IDENTIFIER = "search-test";

const stats = Q.player.minecraft.stats;

let serverId: number;

async function removePlayers(): Promise<void> {
  await Q.player.deleteAll({ minecraftUuid: { $in: UUIDS } });
  await Q.player.deleteAll({ discordId: { $in: DISCORD_IDS } });
}

async function seedStats(
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

beforeAll(async () => {
  const existing = await Q.server.find({ identifier: SERVER_IDENTIFIER });
  serverId =
    existing?.id ??
    (
      await Q.server.createAndReturn({
        name: SERVER_IDENTIFIER,
        identifier: SERVER_IDENTIFIER,
      })
    ).id;
});

beforeEach(async () => {
  await removePlayers();
  const names = ["search_alice", "search_bob", "search_cara"];
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
  await Q.server.deleteAll({ identifier: SERVER_IDENTIFIER });
});

describe("PlayerMinecraftStatsQueries.searchItems (integration)", () => {
  it("only suggests items the chosen category has data for", async () => {
    await seedStats({
      [ALICE]: {
        "minecraft:mined": { "searchtest:ore": 12 },
        "minecraft:killed": { "searchtest:zombie": 3 },
      },
    });

    expect(
      await stats.searchItems("searchtest:", {
        category: "minecraft:killed",
      }),
    ).toEqual(["searchtest:zombie"]);
    expect(await stats.searchItems("searchtest:")).toEqual([
      "searchtest:ore",
      "searchtest:zombie",
    ]);
  });

  it("skips items whose only values are zero", async () => {
    await seedStats({
      [ALICE]: { "minecraft:used": { "searchtest:zeroed": 0 } },
      [BOB]: {
        "minecraft:used": { "searchtest:zeroed": 0, "searchtest:counted": 1 },
      },
    });

    expect(
      await stats.searchItems("searchtest:", { category: "minecraft:used" }),
    ).toEqual(["searchtest:counted"]);
  });

  it("ranks exact and prefix matches first, then by holder count", async () => {
    await seedStats({
      [ALICE]: {
        "minecraft:mined": {
          "searchtest:deepslate_stone_block": 1,
          "searchtest:stone_bricks": 1,
          "searchtest:stone": 1,
        },
      },
      [BOB]: {
        "minecraft:mined": {
          "searchtest:deepslate_stone_block": 1,
          "searchtest:mossy_stone": 1,
        },
      },
      [CARA]: {
        "minecraft:mined": {
          "searchtest:deepslate_stone_block": 1,
          "searchtest:mossy_stone": 1,
        },
      },
    });

    const results = await stats.searchItems("stone", {
      category: "minecraft:mined",
    });

    expect(results.filter((key) => key.startsWith("searchtest:"))).toEqual([
      "searchtest:stone",
      "searchtest:stone_bricks",
      "searchtest:deepslate_stone_block",
      "searchtest:mossy_stone",
    ]);
  });

  it("matches spaces in the search against underscores", async () => {
    await seedStats({
      [ALICE]: { "minecraft:crafted": { "searchtest:iron_ingot": 4 } },
    });

    expect(
      await stats.searchItems("Iron Ingot", {
        category: "minecraft:crafted",
      }),
    ).toContain("searchtest:iron_ingot");
  });
});
