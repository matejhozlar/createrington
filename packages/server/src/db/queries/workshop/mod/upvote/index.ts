import type { Pool, PoolClient } from "pg";
import { WorkshopModUpvoteBaseQueries } from "@/generated/db/workshop_mod_upvote.queries";

/**
 * Custom queries for workshop_mod_upvote table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class WorkshopModUpvoteQueries extends WorkshopModUpvoteBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /** Upvote counts per workshop_mod id, missing ids mean zero. */
  async countGroupedByMod(
    workshopModIds: number[],
  ): Promise<Record<number, number>> {
    if (workshopModIds.length === 0) return {};

    const query = `
      SELECT workshop_mod_id, COUNT(*)::int AS upvote_count
      FROM ${this.table}
      WHERE workshop_mod_id = ANY($1)
      GROUP BY workshop_mod_id`;
    const result = await this.runQuery<{
      workshop_mod_id: number;
      upvote_count: number;
    }>("count upvotes grouped by mod", query, [workshopModIds]);

    const counts: Record<number, number> = {};
    for (const row of result.rows) {
      counts[row.workshop_mod_id] = row.upvote_count;
    }
    return counts;
  }

  /** Number of the player's upvotes on still-pending mods in a workshop. */
  async countPendingByUser(
    workshopId: number,
    discordId: string,
  ): Promise<number> {
    const query = `
      SELECT COUNT(*)::int AS used
      FROM ${this.table} wmu
      JOIN workshop_mod wm ON wm.id = wmu.workshop_mod_id
      WHERE wm.workshop_id = $1 AND wmu.discord_id = $2 AND wm.status = 'pending'`;
    const result = await this.runQuery<{ used: number }>(
      "count pending upvotes by user",
      query,
      [workshopId, discordId],
    );
    return result.rows[0]?.used ?? 0;
  }
}
