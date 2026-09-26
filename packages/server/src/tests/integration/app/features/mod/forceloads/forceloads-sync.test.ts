import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Q } from "@/db";
import { replaceForceloadState } from "@/app/features/mod/forceloads/forceloads.service";
import { getTestPool, cleanupTestPool } from "@/tests/helpers/db";

const SERVER_IDENTIFIER = "forceload-sync-test";
const PLAYER = "3F2504E0-4F89-11D3-9A0C-0305E82C3301";
const MEMBER = "3F2504E0-4F89-11D3-9A0C-0305E82C3302";
const PARTY = "3F2504E0-4F89-11D3-9A0C-0305E82C3399";

let serverId: number;

const chunk = (x: number, active: boolean) => ({
  dimension: "minecraft:overworld",
  x,
  z: 0,
  active,
});

beforeAll(async () => {
  const existing = await Q.server.find({ identifier: SERVER_IDENTIFIER });
  serverId =
    existing?.id ??
    (
      await Q.server.createAndReturn({
        name: "Forceload sync test",
        identifier: SERVER_IDENTIFIER,
      })
    ).id;
});

afterAll(async () => {
  await Q.server.deleteAll({ id: serverId });
  await cleanupTestPool();
});

describe("replaceForceloadState", () => {
  it("links chunks and members to their parents when the mod sends uppercase UUIDs", async () => {
    const payload = {
      serverId,
      players: [{ uuid: PLAYER, chunks: [chunk(1, true), chunk(2, false)] }],
      parties: [
        {
          partyId: PARTY,
          partyName: "Alpha",
          memberCount: 1,
          optedIn: true,
          members: [{ uuid: MEMBER }],
          chunks: [chunk(10, true)],
        },
      ],
    };

    await replaceForceloadState(payload);
    await replaceForceloadState(payload);

    const { rows } = await getTestPool().query<{
      owner: string;
      x: number;
    }>(
      `SELECT COALESCE(p.player_uuid, pa.party_id)::text AS owner, c.x
       FROM server_forceload_chunk c
       LEFT JOIN server_forceload_player p ON p.id = c.player_id
       LEFT JOIN server_forceload_party pa ON pa.id = c.party_id
       WHERE COALESCE(p.server_id, pa.server_id) = $1
       ORDER BY c.x`,
      [serverId],
    );
    expect(rows).toEqual([
      { owner: PLAYER.toLowerCase(), x: 1 },
      { owner: PLAYER.toLowerCase(), x: 2 },
      { owner: PARTY.toLowerCase(), x: 10 },
    ]);

    const party = await Q.server.forceload.party.getPartyMembers(
      serverId,
      PARTY,
    );
    expect(party).toEqual({
      partyName: "Alpha",
      memberUuids: [MEMBER.toLowerCase()],
    });
  });
});
