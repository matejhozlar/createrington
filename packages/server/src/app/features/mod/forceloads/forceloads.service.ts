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

    const playerRows = await tx.server.forceload.player.createManyAndReturn(
      players.map((p) => ({ serverId, playerUuid: p.uuid })),
    );
    const partyRows = await tx.server.forceload.party.createManyAndReturn(
      parties.map((party) => ({
        serverId,
        partyId: party.partyId,
        partyName: party.partyName,
        memberCount: party.memberCount,
        optedIn: party.optedIn,
      })),
    );

    const playerIdByUuid = new Map(
      playerRows.map((row) => [row.playerUuid.toLowerCase(), row.id]),
    );
    const partyIdByUuid = new Map(
      partyRows.map((row) => [row.partyId.toLowerCase(), row.id]),
    );

    await tx.server.forceload.member.createMany(
      parties.flatMap((party) =>
        party.members.map((m) => ({
          partyId: partyIdByUuid.get(party.partyId.toLowerCase())!,
          playerUuid: m.uuid,
        })),
      ),
    );

    await tx.server.forceload.chunk.createMany([
      ...players.flatMap((p) =>
        p.chunks.map((c) => ({
          playerId: playerIdByUuid.get(p.uuid.toLowerCase())!,
          dimension: c.dimension,
          x: c.x,
          z: c.z,
          active: c.active,
        })),
      ),
      ...parties.flatMap((party) =>
        party.chunks.map((c) => ({
          partyId: partyIdByUuid.get(party.partyId.toLowerCase())!,
          dimension: c.dimension,
          x: c.x,
          z: c.z,
          active: c.active,
        })),
      ),
    ]);
  });
}
