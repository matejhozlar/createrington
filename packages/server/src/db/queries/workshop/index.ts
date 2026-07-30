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
      WHERE workshop_id = $1 AND source = 'user'
      UNION
      SELECT vmu.discord_id
      FROM workshop_mod_upvote vmu
      JOIN workshop_mod vm ON vm.id = vmu.workshop_mod_id
      WHERE vm.workshop_id = $1`;
    const result = await this.runQuery<{ discord_id: string }>(
      "workshop participant discord ids",
      query,
      [workshopId],
    );
    return result.rows.map((row) => row.discord_id);
  }
}
