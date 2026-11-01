import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Q } from "@/db";
import {
  replacePartyClaims,
  replacePartyState,
  type PartyClaimDimensionPayload,
} from "@/app/features/mod/parties/parties.service";
import { cleanupTestPool } from "@/tests/helpers/db";

const SERVER_IDENTIFIER = "party-claims-test";
const OWNER = "3F2504E0-4F89-11D3-9A0C-0305E82C3501";
const OTHER = "3f2504e0-4f89-11d3-9a0c-0305e82c3502";
const TEAM = "3f2504e0-4f89-11d3-9a0c-0305e82c3599";
const OVERWORLD = "minecraft:overworld";
const NETHER = "minecraft:the_nether";

let serverId: number;

function snapshot(): PartyClaimDimensionPayload[] {
  return [
    {
      dimension: OVERWORLD,
      owners: [
        {
          owner: OWNER,
          claims: [
            [0, 0],
            [0, 1],
            [1, 0],
          ],
          forceloads: [[5, 5]],
        },
        { owner: OTHER, claims: [[-3, 7]], forceloads: [] },
      ],
    },
    {
      dimension: NETHER,
      owners: [{ owner: OWNER, claims: [[0, 0]], forceloads: [] }],
    },
  ];
}

async function claimRows() {
  return Q.server.party.claim.findAll(
    { serverId },
    {
      orderBy: [
        { field: "dimension" },
        { field: "chunkX" },
        { field: "chunkZ" },
      ],
    },
  );
}

beforeAll(async () => {
  const existing = await Q.server.find({ identifier: SERVER_IDENTIFIER });
  serverId =
    existing?.id ??
    (
      await Q.server.createAndReturn({
        name: "Party claims test",
        identifier: SERVER_IDENTIFIER,
      })
    ).id;
  await Q.server.party.claim.deleteAll({ serverId });
  await Q.server.party.claim.sync.deleteAll({ serverId });
});

afterAll(async () => {
  await Q.server.deleteAll({ id: serverId });
  await cleanupTestPool();
});

describe("replacePartyClaims", () => {
  it("stores every chunk under its dimension and owner with the forceload flag", async () => {
    const result = await replacePartyClaims({
      serverId,
      hash: "a1",
      dimensions: snapshot(),
    });
    expect(result).toEqual({ stored: 6, changed: true });

    const rows = await claimRows();
    expect(rows).toMatchObject([
      { dimension: OVERWORLD, chunkX: -3, chunkZ: 7, ownerUuid: OTHER },
      {
        dimension: OVERWORLD,
        chunkX: 0,
        chunkZ: 0,
        ownerUuid: OWNER.toLowerCase(),
        forceloaded: false,
      },
      { dimension: OVERWORLD, chunkX: 0, chunkZ: 1, forceloaded: false },
      { dimension: OVERWORLD, chunkX: 1, chunkZ: 0, forceloaded: false },
      { dimension: OVERWORLD, chunkX: 5, chunkZ: 5, forceloaded: true },
      { dimension: NETHER, chunkX: 0, chunkZ: 0, forceloaded: false },
    ]);

    const sync = await Q.server.party.claim.sync.find({ serverId });
    expect(sync).toMatchObject({ hash: "a1", chunkCount: 6 });
  });

  it("only moves synced_at when the hash matches the stored one", async () => {
    const before = await Q.server.party.claim.sync.get({ serverId });
    const [firstRow] = await claimRows();

    const result = await replacePartyClaims({
      serverId,
      hash: "a1",
      dimensions: [],
    });
    expect(result).toEqual({ stored: 6, changed: false });

    const after = await Q.server.party.claim.sync.get({ serverId });
    expect(after.syncedAt.getTime()).toBeGreaterThan(before.syncedAt.getTime());
    const rows = await claimRows();
    expect(rows).toHaveLength(6);
    expect(rows[0].id).toBe(firstRow.id);
  });

  it("replaces the server's chunks when the hash changed", async () => {
    const result = await replacePartyClaims({
      serverId,
      hash: "b2",
      dimensions: [
        {
          dimension: OVERWORLD,
          owners: [{ owner: OWNER, claims: [[9, 9]], forceloads: [] }],
        },
      ],
    });
    expect(result).toEqual({ stored: 1, changed: true });

    const rows = await claimRows();
    expect(rows).toMatchObject([
      { dimension: OVERWORLD, chunkX: 9, chunkZ: 9, forceloaded: false },
    ]);
    expect(await Q.server.party.claim.sync.get({ serverId })).toMatchObject({
      hash: "b2",
      chunkCount: 1,
    });
  });

  it("keeps one row per chunk and marks it forceloaded when any listing says so", async () => {
    const result = await replacePartyClaims({
      serverId,
      hash: "c3",
      dimensions: [
        {
          dimension: OVERWORLD,
          owners: [
            {
              owner: OWNER,
              claims: [
                [2, 2],
                [2, 2],
                [3, 3],
              ],
              forceloads: [[3, 3]],
            },
          ],
        },
      ],
    });
    expect(result).toEqual({ stored: 2, changed: true });

    const rows = await claimRows();
    expect(rows).toMatchObject([
      { chunkX: 2, chunkZ: 2, forceloaded: false },
      { chunkX: 3, chunkZ: 3, forceloaded: true },
    ]);
  });

  it("reports the party's chunks per dimension", async () => {
    await replacePartyClaims({ serverId, hash: "d4", dimensions: snapshot() });

    expect(
      await Q.server.party.claim.getDimensionTotals(
        serverId,
        OWNER.toLowerCase(),
      ),
    ).toEqual([
      { dimension: OVERWORLD, claimCount: 4, forceloadCount: 1 },
      { dimension: NETHER, claimCount: 1, forceloadCount: 0 },
    ]);
  });

  it("counts a party's chunks from the snapshot, falling back to the member counters without one", async () => {
    await replacePartyState({
      serverId,
      parties: [
        {
          teamId: TEAM,
          name: "Claimers",
          description: "",
          color: 0,
          freeToJoin: false,
          members: [{ uuid: OWNER, rank: "owner", claims: 99, forceloads: 9 }],
          allies: [],
          tagCode: null,
        },
      ],
    });

    const [withSnapshot] = await Q.server.party.getOverview(serverId);
    expect(withSnapshot).toMatchObject({ claimCount: 5, forceloadCount: 1 });
    expect(await Q.server.party.getStats(serverId)).toMatchObject({
      claimCount: 6,
      forceloadCount: 1,
    });

    await Q.server.party.claim.sync.deleteAll({ serverId });

    const [withoutSnapshot] = await Q.server.party.getOverview(serverId);
    expect(withoutSnapshot).toMatchObject({
      claimCount: 99,
      forceloadCount: 9,
    });
    expect(await Q.server.party.getStats(serverId)).toMatchObject({
      claimCount: 99,
      forceloadCount: 9,
      claimsSyncedAt: null,
    });
  });

  it("applies overlapping snapshots of one server one after the other", async () => {
    const results = await Promise.all(
      ["f6", "g7", "h8"].map((hash, i) =>
        replacePartyClaims({
          serverId,
          hash,
          dimensions: [
            {
              dimension: OVERWORLD,
              owners: [
                {
                  owner: OWNER,
                  claims: [
                    [i, 0],
                    [i, 1],
                  ],
                  forceloads: [],
                },
              ],
            },
          ],
        }),
      ),
    );

    expect(results.map((r) => r.changed)).toEqual([true, true, true]);
    const rows = await claimRows();
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.chunkX)).size).toBe(1);
    const sync = await Q.server.party.claim.sync.get({ serverId });
    expect(["f6", "g7", "h8"]).toContain(sync.hash);
    expect(sync.chunkCount).toBe(2);
  });

  it("clears every chunk of the server on an empty snapshot", async () => {
    const result = await replacePartyClaims({
      serverId,
      hash: "e5",
      dimensions: [],
    });
    expect(result).toEqual({ stored: 0, changed: true });
    expect(await Q.server.party.claim.count({ serverId })).toBe(0);
  });
});
