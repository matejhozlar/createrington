import { db } from "@/db";

export interface PlayerChunkEntry {
  dimension: string;
  x: number;
  z: number;
  forceloadable: boolean;
  active: boolean;
}

export interface PlayerChunkData {
  playerUuid: string;
  partyId: string | null;
  partyName: string | null;
  partyOptedIn: boolean | null;
  chunks: PlayerChunkEntry[];
}

export interface ChunkSyncPayload {
  serverId: number;
  players: PlayerChunkData[];
}

interface FlattenedChunk {
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

function flatten(players: PlayerChunkData[]): FlattenedChunk[] {
  const out: FlattenedChunk[] = [];
  for (const p of players) {
    for (const c of p.chunks) {
      out.push({
        playerUuid: p.playerUuid,
        dimension: c.dimension,
        x: c.x,
        z: c.z,
        partyId: p.partyId,
        partyName: p.partyName,
        partyOptedIn: p.partyOptedIn,
        forceloadable: c.forceloadable,
        active: c.active,
      });
    }
  }
  return out;
}

/**
 * Syncs the full chunk state for a server using mark-and-sweep upsert.
 *
 * An advisory lock on serverId serializes concurrent syncs so the orphan
 * sweep can never race against another in-flight upsert. Within the lock:
 * record syncStart, batch-upsert all chunks (one statement via UNNEST),
 * then DELETE rows whose last_synced_at predates this sync.
 */
export async function syncChunkState(payload: ChunkSyncPayload): Promise<void> {
  const { serverId, players } = payload;
  const rows = flatten(players);

  await db.inTransaction(async (tx) => {
    await tx.server.chunk.acquireSyncLock(serverId);

    const syncStart = new Date();

    await tx.server.chunk.upsertChunks(serverId, rows, syncStart);
    await tx.server.chunk.sweepOrphans(serverId, syncStart);
  });
}
