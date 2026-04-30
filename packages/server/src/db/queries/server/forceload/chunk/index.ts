import type { Pool, PoolClient } from "pg";
import { ServerForceloadChunkBaseQueries } from "@/generated/db/server_forceload_chunk.queries";

export class ServerForceloadChunkQueries extends ServerForceloadChunkBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  async getChunksByOwner(ownerId: number, ownerType: "player" | "party") {
    const column = ownerType === "player" ? "player_id" : "party_id";
    const result = await this.db.query<{
      id: number;
      dimension: string;
      x: number;
      z: number;
      active: boolean;
    }>(
      `SELECT id, dimension, x, z, active
      FROM server_forceload_chunk
      WHERE ${column} = $1
      ORDER BY dimension, x, z`,
      [ownerId],
    );
    return result.rows;
  }

  async getChunksByPartyUuid(serverId: number, partyUuid: string) {
    const result = await this.db.query<{
      id: number;
      dimension: string;
      x: number;
      z: number;
      active: boolean;
    }>(
      `SELECT fc.id, fc.dimension, fc.x, fc.z, fc.active
      FROM server_forceload_chunk fc
      JOIN server_forceload_party fp ON fp.id = fc.party_id
      WHERE fp.server_id = $1 AND fp.party_id = $2
      ORDER BY fc.dimension, fc.x, fc.z`,
      [serverId, partyUuid],
    );
    return result.rows;
  }

  async getChunksByPlayerUuid(serverId: number, playerUuid: string) {
    const result = await this.db.query<{
      id: number;
      dimension: string;
      x: number;
      z: number;
      active: boolean;
    }>(
      `SELECT fc.id, fc.dimension, fc.x, fc.z, fc.active
      FROM server_forceload_chunk fc
      JOIN server_forceload_player fp ON fp.id = fc.player_id
      WHERE fp.server_id = $1 AND fp.player_uuid = $2
      ORDER BY fc.dimension, fc.x, fc.z`,
      [serverId, playerUuid],
    );
    return result.rows;
  }
}
