import type { Pool, PoolClient } from "pg";
import { WorkshopBaseQueries } from "@/generated/db/workshop.queries";

/**
 * Custom queries for workshop table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class WorkshopQueries extends WorkshopBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /** Distinct discord ids of everyone who suggested or upvoted in a workshop. */
  async participantDiscordIds(workshopId: number): Promise<string[]> {
    const query = `
      SELECT submitted_by AS discord_id
      FROM workshop_mod
      WHERE workshop_id = $1
      UNION
      SELECT wmu.discord_id
      FROM workshop_mod_upvote wmu
      JOIN workshop_mod wm ON wm.id = wmu.workshop_mod_id
      WHERE wm.workshop_id = $1`;
    const result = await this.runQuery<{ discord_id: string }>(
      "workshop participant discord ids",
      query,
      [workshopId],
    );
    return result.rows.map((row) => row.discord_id);
  }

  /** Serialize a user's per-workshop cap checks for the current transaction. */
  async lockUserBudget(workshopId: number, discordId: string): Promise<void> {
    const query = `
      SELECT pg_advisory_xact_lock(
        hashtextextended('workshop_user_budget:' || $1 || ':' || $2, 0)
      )`;
    await this.runQuery("lock workshop user budget", query, [
      workshopId,
      discordId,
    ]);
  }
}
