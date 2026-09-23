import type { Pool, PoolClient } from "pg";
import { PlayerMinecraftStatKeyBaseQueries } from "@/generated/db/player_minecraft_stat_key.queries";
import { escapeLike } from "@/db/utils";

/**
 * Custom queries for player_minecraft_stat_key, the catalogue of every numeric
 * stat seen in player_minecraft_stats.
 *
 * - Search stat items that at least one player has a nonzero total for
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
}
