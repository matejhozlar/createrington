import type { Pool, PoolClient } from "pg";
import { PlayerMinecraftStatKeyBaseQueries } from "@/generated/db/player_minecraft_stat_key.queries";
import { escapeLike } from "@/db/utils";

export interface StatSearchResult {
  category: string;
  item: string;
  holders: number;
}

const HIDDEN_STATS = [
  "minecraft:time_since_death",
  "minecraft:time_since_rest",
];

/**
 * Custom queries for player_minecraft_stat_key, the catalogue of every numeric
 * stat seen in player_minecraft_stats.
 *
 * - Search stat items that at least one player has a nonzero total for
 * - Search (category, item) stats for the public leaderboards stat picker
 */
export class PlayerMinecraftStatKeyQueries extends PlayerMinecraftStatKeyBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /**
   * Search item keys (e.g. "minecraft:diamond", "northstar:targeting_computer")
   * that at least one player has a nonzero total for, within one category or
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
      SELECT k.item
      FROM ${this.table} k
      JOIN player_minecraft_stat_total t ON t.stat_key_id = k.id
      WHERE ($1::text IS NULL OR k.category = $1)
        AND k.item ILIKE $2
      GROUP BY k.item
      ORDER BY
        ($3::text <> '' AND (
          lower(k.item) = $3 OR lower(split_part(k.item, ':', 2)) = $3
        )) DESC,
        (lower(k.item) LIKE $4 OR lower(split_part(k.item, ':', 2)) LIKE $4) DESC,
        count(DISTINCT t.minecraft_uuid) DESC,
        SUM(t.value) DESC,
        k.item
      LIMIT $5
    `;

    const result = await this.runQuery<{ item: string }>(
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
    return result.rows.map((row) => row.item);
  }

  /**
   * Search individual stats (a category + item pair) by item name for the
   * public stat picker. The name part of the item key is matched, plus the mod
   * namespace by prefix for modded items (so "create" finds Create items while
   * "mi" does not match every minecraft: key). Only stats at least one player
   * holds are returned; exact and prefix name matches rank first, then the
   * stats held by the most players. Spaces in the search match underscores.
   */
  async searchStats(search: string, limit = 12): Promise<StatSearchResult[]> {
    const term = search.trim().toLowerCase().replace(/\s+/g, "_");
    const pattern = escapeLike(term);

    const query = `
      SELECT k.category, k.item, count(*)::int AS holders
      FROM ${this.table} k
      JOIN player_minecraft_stat_total t ON t.stat_key_id = k.id
      WHERE (
          split_part(k.item, ':', 2) ILIKE $1
          OR (
            split_part(k.item, ':', 1) <> 'minecraft'
            AND split_part(k.item, ':', 1) ILIKE $3
          )
        )
        AND NOT (k.category = 'minecraft:custom' AND k.item = ANY($4))
      GROUP BY k.id
      ORDER BY
        (lower(split_part(k.item, ':', 2)) = $2) DESC,
        (lower(split_part(k.item, ':', 2)) LIKE $3) DESC,
        count(*) DESC,
        k.item,
        k.category
      LIMIT $5
    `;

    const result = await this.runQuery<StatSearchResult>(
      "search minecraft stats",
      query,
      [`%${pattern}%`, term, `${pattern}%`, HIDDEN_STATS, limit],
    );
    return result.rows;
  }
}
