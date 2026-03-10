import type { Pool, PoolClient } from "pg";
import { PlayerMinecraftStatsBaseQueries } from "@/generated/db/player_minecraft_stats.queries";

export interface StatsUpsertEntry {
  minecraftUuid: string;
  stats: Record<string, unknown>;
  dataVersion: number | null;
}

/**
 * Custom queries for player_minecraft_stats table
 *
 * - Batch upsert for efficient multi-player stats ingestion from game servers
 */
export class PlayerMinecraftStatsQueries extends PlayerMinecraftStatsBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /**
   * Batch upsert stats for multiple players on a single server
   *
   * Uses INSERT ... ON CONFLICT DO UPDATE to insert or update stats
   * for all provided players in a single query.
   *
   * @param serverId - The server these stats belong to
   * @param entries - Array of player stats to upsert
   */
  async batchUpsert(
    serverId: number,
    entries: StatsUpsertEntry[],
  ): Promise<void> {
    if (entries.length === 0) return;

    const values: unknown[] = [];
    const rows: string[] = [];

    for (let i = 0; i < entries.length; i++) {
      const offset = i * 4;
      rows.push(
        `($${offset + 1}::uuid, $${offset + 2}::integer, $${offset + 3}::jsonb, $${offset + 4}::integer)`,
      );
      values.push(
        entries[i].minecraftUuid,
        serverId,
        JSON.stringify(entries[i].stats),
        entries[i].dataVersion,
      );
    }

    const query = `
      INSERT INTO ${this.table} (minecraft_uuid, server_id, stats, data_version)
      VALUES ${rows.join(", ")}
      ON CONFLICT (minecraft_uuid, server_id) DO UPDATE SET
        stats = EXCLUDED.stats,
        data_version = EXCLUDED.data_version,
        updated_at = NOW()
    `;

    try {
      await this.db.query(query, values);
    } catch (error) {
      logger.error("Failed to batch upsert minecraft stats:", error);
      throw error;
    }
  }
}
