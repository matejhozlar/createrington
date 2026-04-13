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
}
