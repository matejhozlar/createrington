import type { Pool, PoolClient } from "pg";
import { PlayerMinecraftStatsBaseQueries } from "@/generated/db/player_minecraft_stats.queries";
import { escapeLike } from "@/db/utils";

export interface StatsUpsertEntry {
  minecraftUuid: string;
  stats: Record<string, unknown>;
  dataVersion: number | null;
}

export interface StatCompareResult {
  minecraftUuid: string;
  minecraftUsername: string;
  values: number[];
}

export interface RecordLeaderboardEntry {
  minecraftUuid: string;
  minecraftUsername: string;
  discordId: string;
  records: number;
}

export interface RecordLeaderboard {
  rows: RecordLeaderboardEntry[];
  contestedKeys: number;
}

const RECORD_CATEGORIES = [
  "minecraft:mined",
  "minecraft:killed",
  "minecraft:crafted",
  "minecraft:used",
  "minecraft:broken",
  "minecraft:custom",
];

const RECORD_CUSTOM_BLOCKLIST = [
  "minecraft:play_time",
  "minecraft:total_world_time",
  "minecraft:time_since_death",
  "minecraft:time_since_rest",
  "minecraft:leave_game",
  "minecraft:deaths",
  "minecraft:damage_taken",
  "minecraft:drop",
];

const RECORD_MIN_HOLDERS = 2;

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
   * Search item keys (e.g. "minecraft:diamond", "northstar:targeting_computer")
   * that at least one player has a nonzero value for, within one category or
   * across all of them. Exact and prefix matches on the item name rank first,
   * then items held by the most players. Spaces in the search match underscores.
   */
  async searchItems(
    search: string,
    options?: { category?: string; limit?: number },
  ): Promise<string[]> {
    const term = search.trim().toLowerCase().replace(/\s+/g, "_");
    const pattern = escapeLike(term);

    const query = `
      SELECT item.key
      FROM ${this.table} s,
        jsonb_each(s.stats) AS cat(key, value),
        jsonb_each_text(cat.value) AS item(key, value)
      WHERE ($1::text IS NULL OR cat.key = $1)
        AND item.key ILIKE $2
        AND item.value::bigint > 0
      GROUP BY item.key
      ORDER BY
        (item.key = $3 OR split_part(item.key, ':', 2) = $3) DESC,
        (item.key LIKE $4 OR split_part(item.key, ':', 2) LIKE $4) DESC,
        count(DISTINCT s.minecraft_uuid) DESC,
        SUM(item.value::bigint) DESC,
        item.key
      LIMIT $5
    `;

    const result = await this.runQuery<{ key: string }>(
      "search minecraft stat items",
      query,
      [
        options?.category ?? null,
        `%${pattern}%`,
        term,
        `${pattern}%`,
        options?.limit ?? 50,
      ],
    );
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

    // Build dynamic SELECT columns: one per category
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
   * Ranks players by how many stats they lead. Values are summed across
   * servers, a stat counts only once RECORD_MIN_HOLDERS players have a nonzero
   * value for it, and a tie at a stat awards every tied player. Omit the limit
   * to get every player holding at least one record.
   */
  async getRecordLeaderboard(limit?: number): Promise<RecordLeaderboard> {
    const query = `
      WITH pairs AS (
        SELECT
          s.minecraft_uuid,
          cat.key AS category,
          item.key AS item,
          SUM(item.value::bigint) AS value
        FROM ${this.table} s,
          jsonb_each(s.stats) AS cat(key, value),
          jsonb_each_text(cat.value) AS item(key, value)
        WHERE cat.key = ANY($1)
          AND NOT (cat.key = 'minecraft:custom' AND item.key = ANY($2))
        GROUP BY s.minecraft_uuid, cat.key, item.key
        HAVING SUM(item.value::bigint) > 0
      ),
      ranked AS (
        SELECT
          minecraft_uuid,
          category,
          item,
          rank() OVER (PARTITION BY category, item ORDER BY value DESC) AS position,
          count(*) OVER (PARTITION BY category, item) AS holders
        FROM pairs
      )
      SELECT
        p.minecraft_uuid AS "minecraftUuid",
        p.minecraft_username AS "minecraftUsername",
        p.discord_id AS "discordId",
        count(*)::int AS records,
        (
          SELECT count(DISTINCT (category, item))
          FROM ranked
          WHERE holders >= $3
        )::int AS "contestedKeys"
      FROM ranked r
      JOIN player p ON p.minecraft_uuid = r.minecraft_uuid
      WHERE r.position = 1 AND r.holders >= $3
      GROUP BY p.minecraft_uuid, p.minecraft_username, p.discord_id
      ORDER BY records DESC, p.minecraft_username ASC
      LIMIT $4
    `;

    const result = await this.runQuery<
      RecordLeaderboardEntry & { contestedKeys: number }
    >("get record leaderboard", query, [
      RECORD_CATEGORIES,
      RECORD_CUSTOM_BLOCKLIST,
      RECORD_MIN_HOLDERS,
      limit ?? null,
    ]);

    return {
      rows: result.rows.map((row) => ({
        minecraftUuid: row.minecraftUuid,
        minecraftUsername: row.minecraftUsername,
        discordId: row.discordId,
        records: row.records,
      })),
      contestedKeys: result.rows[0]?.contestedKeys ?? 0,
    };
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
    `;

    await this.runQuery("batch upsert minecraft stats", query, values);
  }
}
