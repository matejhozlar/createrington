import { db } from "@/db";

export interface ChunkPayload {
  dimension: string;
  x: number;
  z: number;
  active: boolean;
}

export interface PlayerPayload {
  uuid: string;
  chunks: ChunkPayload[];
}

export interface PartyMemberPayload {
  uuid: string;
}

export interface PartyPayload {
  partyId: string;
  partyName: string;
  memberCount: number;
  optedIn: boolean;
  members: PartyMemberPayload[];
  chunks: ChunkPayload[];
}

export interface ForceloadSyncPayload {
  serverId: number;
  players: PlayerPayload[];
  parties: PartyPayload[];
}

/**
 * Replaces the full forceload state for a server.
 *
 * Within a single transaction this deletes all existing player and party rows
 * for the server (chunks and members cascade), then inserts the new state.
 * The mod always sends a complete snapshot, so a full replace is correct.
 */
export async function replaceForceloadState(
  payload: ForceloadSyncPayload,
): Promise<void> {
  const { serverId, players, parties } = payload;

  await db.inTransaction(async (tx) => {
    // Chunks and members cascade from their parent rows.
    await tx.server.forceload.player.deleteAll({ serverId });
    await tx.server.forceload.party.deleteAll({ serverId });

    for (const p of players) {
      const playerRow = await tx.server.forceload.player.createAndReturn({
        serverId,
        playerUuid: p.uuid,
      });

      for (const c of p.chunks) {
        await tx.server.forceload.chunk.create({
          playerId: playerRow.id,
          dimension: c.dimension,
          x: c.x,
          z: c.z,
          active: c.active,
        });
      }
    }

    for (const party of parties) {
      const partyRow = await tx.server.forceload.party.createAndReturn({
        serverId,
        partyId: party.partyId,
        partyName: party.partyName,
        memberCount: party.memberCount,
        optedIn: party.optedIn,
      });

      for (const m of party.members) {
        await tx.server.forceload.member.create({
          partyId: partyRow.id,
          playerUuid: m.uuid,
        });
      }

      for (const c of party.chunks) {
        await tx.server.forceload.chunk.create({
          partyId: partyRow.id,
          dimension: c.dimension,
          x: c.x,
          z: c.z,
          active: c.active,
        });
      }
    }
  });
}
