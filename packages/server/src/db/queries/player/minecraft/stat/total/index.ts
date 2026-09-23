import type { Pool, PoolClient } from "pg";
import { PlayerMinecraftStatTotalBaseQueries } from "@/generated/db/player_minecraft_stat_total.queries";

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

const STAT_PAIRS_FROM = `
  FROM player_minecraft_stats s
  CROSS JOIN LATERAL jsonb_each(
    CASE WHEN jsonb_typeof(s.stats) = 'object' THEN s.stats ELSE '{}'::jsonb END
  ) AS cat(key, value)
  CROSS JOIN LATERAL jsonb_each(
    CASE WHEN jsonb_typeof(cat.value) = 'object' THEN cat.value ELSE '{}'::jsonb END
  ) AS item(key, value)
`;

const STAT_PAIRS_WHERE = `
  WHERE s.minecraft_uuid = ANY($1::uuid[])
    AND jsonb_typeof(item.value) = 'number'
`;

/**
 * Custom queries for player_minecraft_stat_total, the per-player projection of
 * player_minecraft_stats summed across servers.
 *
 * - Rebuild a player's totals from their stats rows (run by the stats import)
 * - Rank every player on one stat, and count stat records (#1 placements)
 */
export class PlayerMinecraftStatTotalQueries extends PlayerMinecraftStatTotalBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /**
   * Rebuild the totals of the given players from their current stats rows,
   * registering any stat key not seen before. Must run inside the transaction
   * that wrote the stats rows; concurrent refreshes are serialized so a player
   * imported by two servers at once always ends up with both servers summed.
   */
  async refreshPlayers(minecraftUuids: string[]): Promise<void> {
    if (minecraftUuids.length === 0) return;
    if (!this.isInTransaction()) {
      throw new Error(
        "refreshPlayers must run inside the stats import transaction",
      );
    }

    await this.runQuery(
      "lock minecraft stat totals",
      `SELECT pg_advisory_xact_lock(hashtextextended('player_minecraft_stat_total', 0))`,
    );
    await this.runQuery(
      "register minecraft stat keys",
      `INSERT INTO player_minecraft_stat_key (category, item)
       SELECT DISTINCT cat.key, item.key
       ${STAT_PAIRS_FROM}
       ${STAT_PAIRS_WHERE}
       ON CONFLICT (category, item) DO NOTHING`,
      [minecraftUuids],
    );
    await this.runQuery(
      "clear minecraft stat totals",
      `DELETE FROM ${this.table} WHERE minecraft_uuid = ANY($1::uuid[])`,
      [minecraftUuids],
    );
    await this.runQuery(
      "rebuild minecraft stat totals",
      `INSERT INTO ${this.table} (stat_key_id, minecraft_uuid, value)
       SELECT k.id, s.minecraft_uuid, LEAST(SUM(item.value::numeric), 9223372036854775807)::bigint
       ${STAT_PAIRS_FROM}
       JOIN player_minecraft_stat_key k
         ON k.category = cat.key AND k.item = item.key
       ${STAT_PAIRS_WHERE}
       GROUP BY k.id, s.minecraft_uuid
       HAVING LEAST(SUM(item.value::numeric), 9223372036854775807)::bigint > 0`,
      [minecraftUuids],
    );
  }

  /**
   * Compare a single item across multiple categories for all players.
   *
   * Returns one row per player with an array of values corresponding to each
   * requested category, ordered by the sum of those values.
   */
  async compareItem(
    item: string,
    categories: string[],
    options?: { limit?: number },
  ): Promise<StatCompareResult[]> {
    if (categories.length === 0) return [];

    const query = `
      SELECT
        p.minecraft_uuid AS "minecraftUuid",
        p.minecraft_username AS "minecraftUsername",
        array_agg(COALESCE(v.value, 0)::float8 ORDER BY c.position) AS "values"
      FROM player p
      CROSS JOIN unnest($2::text[]) WITH ORDINALITY AS c(category, position)
      LEFT JOIN player_minecraft_stat_key k
        ON k.category = c.category AND k.item = $1
      LEFT JOIN ${this.table} v
        ON v.stat_key_id = k.id AND v.minecraft_uuid = p.minecraft_uuid
      WHERE p.minecraft_uuid IN (
        SELECT t.minecraft_uuid
        FROM ${this.table} t
        JOIN player_minecraft_stat_key tk ON tk.id = t.stat_key_id
        WHERE tk.item = $1 AND tk.category = ANY($2::text[])
      )
      GROUP BY p.minecraft_uuid, p.minecraft_username
      ORDER BY SUM(COALESCE(v.value, 0)) DESC, p.minecraft_username ASC
      LIMIT $3
    `;

    const result = await this.runQuery<StatCompareResult>(
      "compare minecraft stat item",
      query,
      [item, categories, options?.limit ?? 200],
    );
    return result.rows;
  }

  /**
   * Ranks players by how many stats they lead. Values are summed across
   * servers, a stat counts only once RECORD_MIN_HOLDERS players have a nonzero
   * value for it, and a tie at a stat awards every tied player. Omit the limit
   * to get every player holding at least one record.
   */
  async getRecordLeaderboard(limit?: number): Promise<RecordLeaderboard> {
    const query = `
      WITH ranked AS (
        SELECT
          t.minecraft_uuid,
          t.stat_key_id,
          rank() OVER (PARTITION BY t.stat_key_id ORDER BY t.value DESC) AS position,
          count(*) OVER (PARTITION BY t.stat_key_id) AS holders
        FROM ${this.table} t
        JOIN player_minecraft_stat_key k ON k.id = t.stat_key_id
        WHERE k.category = ANY($1)
          AND NOT (k.category = 'minecraft:custom' AND k.item = ANY($2))
      )
      SELECT
        p.minecraft_uuid AS "minecraftUuid",
        p.minecraft_username AS "minecraftUsername",
        p.discord_id AS "discordId",
        count(*)::int AS records,
        (
          SELECT count(DISTINCT stat_key_id)
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
}
