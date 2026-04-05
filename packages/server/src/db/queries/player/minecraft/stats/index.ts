import type { Pool, PoolClient } from "pg";
import { PlayerMinecraftStatsBaseQueries } from "@/generated/db/player_minecraft_stats.queries";

export interface StatsUpsertEntry {
  minecraftUuid: string;
  stats: Record<string, unknown>;
  dataVersion: number | null;
}

export interface StatSearchResult {
  minecraftUuid: string;
  minecraftUsername: string;
  value: number;
}

export interface StatCompareResult {
  minecraftUuid: string;
  minecraftUsername: string;
  values: number[];
}

/**
 * Custom queries for player_minecraft_stats table
 *
 * - Batch upsert for efficient multi-player stats ingestion from game servers
 * - Search across all players for a specific stat key
 */
export class PlayerMinecraftStatsQueries extends PlayerMinecraftStatsBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /**
   * Search all players for a specific stat within a category.
   *
   * Queries the JSONB `stats` column across all rows, joining with the player
   * table to return usernames. Results are summed across servers and sorted
   * by value descending.
   */
  async searchByStat(
    category: string,
    item: string,
    options?: { serverId?: number; limit?: number },
  ): Promise<StatSearchResult[]> {
    const limit = options?.limit ?? 100;
    const values: unknown[] = [category, item, limit];
    let serverFilter = "";

    if (options?.serverId) {
      serverFilter = "AND s.server_id = $4";
      values.push(options.serverId);
    }

    const query = `
      SELECT
        p.minecraft_uuid AS "minecraftUuid",
        p.minecraft_username AS "minecraftUsername",
        SUM((s.stats -> $1 ->> $2)::bigint)::bigint AS "value"
      FROM ${this.table} s
      JOIN player p ON p.minecraft_uuid = s.minecraft_uuid
      WHERE s.stats -> $1 ? $2
      ${serverFilter}
      GROUP BY p.minecraft_uuid, p.minecraft_username
      HAVING SUM((s.stats -> $1 ->> $2)::bigint) > 0
      ORDER BY "value" DESC
      LIMIT $3
    `;

    const result = await this.db.query<StatSearchResult>(query, values);
    return result.rows.map((r) => ({ ...r, value: Number(r.value) }));
  }

  /**
   * Get all distinct stat keys within a category across all players.
   */
  async getStatKeys(category: string): Promise<string[]> {
    const query = `
      SELECT DISTINCT key
      FROM ${this.table}, jsonb_object_keys(stats -> $1) AS key
      WHERE stats ? $1
      ORDER BY key
    `;

    const result = await this.db.query<{ key: string }>(query, [category]);
    return result.rows.map((r) => r.key);
  }

  /**
   * Get all distinct stat categories across all players.
   */
  async getCategories(): Promise<string[]> {
    const query = `
      SELECT DISTINCT key
      FROM ${this.table}, jsonb_object_keys(stats) AS key
      ORDER BY key
    `;

    const result = await this.db.query<{ key: string }>(query, []);
    return result.rows.map((r) => r.key);
  }

  /**
   * Search for item keys matching a query string across all categories.
   * Returns distinct item names (e.g. "minecraft:diamond", "northstar:targeting_computer").
   */
  async searchItems(search: string, limit?: number): Promise<string[]> {
    const query = `
      SELECT DISTINCT key
      FROM ${this.table},
        jsonb_each(stats) AS entries(cat, items),
        jsonb_object_keys(items) AS key
      WHERE key ILIKE $1
      ORDER BY key
      LIMIT $2
    `;

    const result = await this.db.query<{ key: string }>(query, [
      `%${search}%`,
      limit ?? 50,
    ]);
    return result.rows.map((r) => r.key);
  }

  /**
   * Compare a single item across multiple categories for all players.
   *
   * Returns one row per player with an array of values corresponding to each
   * requested category. Values are summed across servers.
   */
  async compareItem(
    item: string,
    categories: string[],
    options?: { limit?: number },
  ): Promise<StatCompareResult[]> {
    if (categories.length === 0) return [];

    const limit = options?.limit ?? 200;

    // $1 = item, $2..$n+1 = categories, $n+2 = limit
    const values: unknown[] = [item];
    const catParams: string[] = [];

    for (const cat of categories) {
      values.push(cat);
      catParams.push(`$${values.length}`);
    }

    values.push(limit);
    const limitParam = `$${values.length}`;

    // Build dynamic SELECT columns — one per category
    const selectCols = catParams
      .map(
        (p, i) =>
          `COALESCE(SUM((s.stats -> ${p} ->> $1)::bigint), 0)::bigint AS "cat_${i}"`,
      )
      .join(",\n      ");

    // WHERE: player has the item in at least one of the categories
    const whereClauses = catParams
      .map((p) => `s.stats -> ${p} ? $1`)
      .join(" OR ");

    // HAVING: at least one category has a non-zero value
    const havingClauses = catParams
      .map((p) => `COALESCE(SUM((s.stats -> ${p} ->> $1)::bigint), 0) > 0`)
      .join(" OR ");

    // ORDER BY total across all categories
    const orderExpr = catParams
      .map((p) => `COALESCE(SUM((s.stats -> ${p} ->> $1)::bigint), 0)`)
      .join(" + ");

    const query = `
      SELECT
        p.minecraft_uuid AS "minecraftUuid",
        p.minecraft_username AS "minecraftUsername",
        ${selectCols}
      FROM ${this.table} s
      JOIN player p ON p.minecraft_uuid = s.minecraft_uuid
      WHERE ${whereClauses}
      GROUP BY p.minecraft_uuid, p.minecraft_username
      HAVING ${havingClauses}
      ORDER BY (${orderExpr}) DESC
      LIMIT ${limitParam}
    `;

    const result = await this.db.query(query, values);
    return result.rows.map((row: Record<string, unknown>) => ({
      minecraftUuid: row.minecraftUuid as string,
      minecraftUsername: row.minecraftUsername as string,
      values: categories.map((_, i) => Number(row[`cat_${i}`])),
    }));
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
