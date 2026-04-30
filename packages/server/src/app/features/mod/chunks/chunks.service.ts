import pool from "@/db";
import { transaction } from "@/db";
import { Q } from "@/db";

export interface ChunkPayload {
  playerUuid: string;
  dimension: string;
  x: number;
  z: number;
  partyId: string | null;
  partyName: string | null;
  partyOptedIn: boolean | null;
  forceloadable: boolean;
  active: boolean;
}

export interface ChunkSyncPayload {
  serverId: number;
  chunks: ChunkPayload[];
}

/**
 * Syncs the full chunk state for a server using mark-and-sweep upsert.
 *
 * 1. Record sync_start timestamp
 * 2. Upsert each chunk by (server_id, dimension, x, z)
 *    - original_player_uuid is only updated when the incoming player_uuid
 *      belongs to a real player (exists in the player table AND is not the
 *      fake player UUID from the stored ally state)
 * 3. Delete all chunks for this server where last_synced_at < sync_start
 *    (orphan sweep — handles unclaimed chunks)
 */
export async function syncChunkState(payload: ChunkSyncPayload): Promise<void> {
  const { serverId, chunks } = payload;

  await transaction(pool, async (client) => {
    const syncStart = new Date();

    // Look up fake player UUID from stored ally state
    const fakePartyResult = await Q.server.ally.fake.party.find({ serverId });
    const fakePlayerUuid = fakePartyResult?.ownerUuid ?? null;

    // Batch-fetch known player UUIDs from the player table
    const uniquePlayerUuids = [...new Set(chunks.map((c) => c.playerUuid))];
    let knownPlayerSet = new Set<string>();

    if (uniquePlayerUuids.length > 0) {
      const knownPlayers = await client.query<{
        minecraft_uuid: string;
      }>(
        `SELECT minecraft_uuid FROM player WHERE minecraft_uuid = ANY($1::uuid[])`,
        [uniquePlayerUuids],
      );
      knownPlayerSet = new Set(knownPlayers.rows.map((r) => r.minecraft_uuid));
    }

    // Upsert each chunk
    for (const chunk of chunks) {
      const isRealPlayer =
        knownPlayerSet.has(chunk.playerUuid) &&
        chunk.playerUuid !== fakePlayerUuid;

      await client.query(
        `INSERT INTO server_chunk (
          server_id, dimension, x, z, player_uuid, original_player_uuid,
          party_id, party_name, party_opted_in, forceloadable, active, last_synced_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (server_id, dimension, x, z) DO UPDATE SET
          player_uuid = EXCLUDED.player_uuid,
          original_player_uuid = CASE
            WHEN $13 THEN EXCLUDED.original_player_uuid
            ELSE server_chunk.original_player_uuid
          END,
          party_id = EXCLUDED.party_id,
          party_name = EXCLUDED.party_name,
          party_opted_in = EXCLUDED.party_opted_in,
          forceloadable = EXCLUDED.forceloadable,
          active = EXCLUDED.active,
          last_synced_at = EXCLUDED.last_synced_at`,
        [
          serverId,
          chunk.dimension,
          chunk.x,
          chunk.z,
          chunk.playerUuid,
          chunk.playerUuid, // original_player_uuid = player_uuid on insert
          chunk.partyId,
          chunk.partyName,
          chunk.partyOptedIn,
          chunk.forceloadable,
          chunk.active,
          syncStart,
          isRealPlayer, // $13: whether to update original_player_uuid
        ],
      );
    }

    // Orphan sweep: delete chunks not touched in this sync
    await client.query(
      `DELETE FROM server_chunk WHERE server_id = $1 AND last_synced_at < $2`,
      [serverId, syncStart],
    );
  });
}
