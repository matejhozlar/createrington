import { db } from "@/db";

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
 * An advisory lock on serverId serializes concurrent syncs so the orphan
 * sweep can never race against another in-flight upsert. Within the lock:
 * record syncStart, batch-upsert all chunks (one statement via UNNEST),
 * then DELETE rows whose last_synced_at predates this sync.
 */
export async function syncChunkState(payload: ChunkSyncPayload): Promise<void> {
  const { serverId, chunks } = payload;

  await db.inTransaction(async (tx) => {
    await tx.server.chunk.acquireSyncLock(serverId);

    const syncStart = new Date();

    await tx.server.chunk.upsertChunks(serverId, chunks, syncStart);
    await tx.server.chunk.sweepOrphans(serverId, syncStart);
  });
}
