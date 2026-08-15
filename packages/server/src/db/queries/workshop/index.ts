import type { Pool, PoolClient } from "pg";
import type { Workshop } from "@createrington/shared/db";
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

  /** Every workshop, newest first, with how many mods it holds. */
  async listAllWithModCount(): Promise<(Workshop & { modCount: number })[]> {
    const query = `
      SELECT w.*, COALESCE(m.mod_count, 0)::int AS mod_count
      FROM ${this.table} w
      LEFT JOIN (
        SELECT workshop_id, COUNT(*)::int AS mod_count
        FROM workshop_mod
        GROUP BY workshop_id
      ) m ON m.workshop_id = w.id
      ORDER BY w.created_at DESC`;
    const result = await this.runQuery<
      Record<string, unknown> & { mod_count: number }
    >("list workshops with mod count", query);
    return result.rows.map((row) => ({
      ...this.mapRowToEntity(row as never),
      modCount: row.mod_count,
    }));
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
    if (!this.isInTransaction()) {
      throw new Error(
        "lockUserBudget must run inside a transaction, pg_advisory_xact_lock releases at statement end otherwise",
      );
    }
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
