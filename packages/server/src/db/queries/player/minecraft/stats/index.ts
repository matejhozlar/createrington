import type { Pool, PoolClient } from "pg";
import { PlayerMinecraftStatsBaseQueries } from "@/generated/db/player_minecraft_stats.queries";
import { PlayerMinecraftStatTotalQueries } from "@/db/queries/player/minecraft/stat/total";
import { transaction } from "@/db/utils/transactions";

export interface StatsUpsertEntry {
  minecraftUuid: string;
  stats: Record<string, unknown>;
  dataVersion: number | null;
}

/**
 * Custom queries for player_minecraft_stats table
 *
 * - Batch upsert for efficient multi-player stats ingestion from game servers,
 *   keeping the player_minecraft_stat_total projection in step
 */
export class PlayerMinecraftStatsQueries extends PlayerMinecraftStatsBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /**
   * Batch upsert stats for multiple players on a single server, then rebuild
   * the stat totals of every player whose stats were inserted or changed, all
   * in one transaction. Rows whose stats and data version are unchanged are
   * left untouched (updated_at included), so a re-import of identical files
   * writes nothing.
   *
   * @returns The Minecraft UUIDs whose stats were inserted or changed
   */
  async batchUpsert(
    serverId: number,
    entries: StatsUpsertEntry[],
  ): Promise<string[]> {
    if (entries.length === 0) return [];
    if (!this.isInTransaction()) {
      return transaction(this.db as Pool, (client) =>
        this.useClient(client).batchUpsert(serverId, entries),
      );
    }

    const values: unknown[] = [serverId];
    const rows: string[] = [];

    for (const entry of entries) {
      const uuidIdx = values.push(entry.minecraftUuid);
      const statsIdx = values.push(JSON.stringify(entry.stats));
      const versionIdx = values.push(entry.dataVersion);
      rows.push(
        `($${uuidIdx}::uuid, $${statsIdx}::jsonb, $${versionIdx}::integer)`,
      );
    }

    const query = `
      INSERT INTO ${this.table} (minecraft_uuid, server_id, stats, data_version)
      SELECT v.minecraft_uuid, $1::integer, v.stats, v.data_version
      FROM (VALUES ${rows.join(", ")}) AS v(minecraft_uuid, stats, data_version)
      JOIN player p ON p.minecraft_uuid = v.minecraft_uuid
      ON CONFLICT (minecraft_uuid, server_id) DO UPDATE SET
        stats = EXCLUDED.stats,
        data_version = EXCLUDED.data_version,
        updated_at = NOW()
      WHERE ${this.table}.stats IS DISTINCT FROM EXCLUDED.stats
        OR ${this.table}.data_version IS DISTINCT FROM EXCLUDED.data_version
      RETURNING minecraft_uuid
    `;

    const result = await this.runQuery<{ minecraft_uuid: string }>(
      "batch upsert minecraft stats",
      query,
      values,
    );
    const changed = result.rows.map((row) => row.minecraft_uuid);
    await new PlayerMinecraftStatTotalQueries(this.db).refreshPlayers(changed);
    return changed;
  }
}
