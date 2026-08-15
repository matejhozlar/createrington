import type { Pool, PoolClient } from "pg";
import type { WorkshopBan, WorkshopBanRow } from "@createrington/shared/db";
import { WorkshopBanBaseQueries } from "@/generated/db/workshop_ban.queries";

export interface WorkshopBanWithScope extends WorkshopBan {
  workshopName: string | null;
}

/**
 * Custom queries for workshop_ban table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class WorkshopBanQueries extends WorkshopBanBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /**
   * Find the active ban that blocks suggesting in a workshop, if any
   *
   * Global bans (workshop_id IS NULL) apply to every workshop. Permanent
   * bans win over temporary ones so the caller reports the binding one.
   *
   * @param discordId - Discord ID of the suggester
   * @param workshopId - Workshop being suggested into
   * @returns Promise resolving to the binding ban or null
   */
  async findActiveFor(
    discordId: string,
    workshopId: number,
  ): Promise<WorkshopBan | null> {
    const query = `
      SELECT * FROM ${this.table}
      WHERE discord_id = $1
        AND unbanned = false
        AND (
          expires_at IS NULL OR
          expires_at > NOW()
        )
        AND (
          workshop_id IS NULL OR
          workshop_id = $2
        )
      ORDER BY (expires_at IS NULL) DESC, expires_at DESC, banned_at DESC
      LIMIT 1`;

    const result = await this.runQuery<WorkshopBanRow>(
      "find active workshop ban",
      query,
      [discordId, workshopId],
    );
    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  /**
   * Find an active ban in one exact scope, used to reject duplicates
   *
   * @param discordId - Discord ID of the banned user
   * @param workshopId - Workshop scope, or null for the global scope
   * @returns Promise resolving to the active ban in that scope or null
   */
  async findActiveInScope(
    discordId: string,
    workshopId: number | null,
  ): Promise<WorkshopBan | null> {
    const query = `
      SELECT * FROM ${this.table}
      WHERE discord_id = $1
        AND workshop_id IS NOT DISTINCT FROM $2
        AND unbanned = false
        AND (
          expires_at IS NULL OR
          expires_at > NOW()
        )
      ORDER BY banned_at DESC
      LIMIT 1`;

    const result = await this.runQuery<WorkshopBanRow>(
      "find active workshop ban in scope",
      query,
      [discordId, workshopId],
    );
    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  /**
   * List a user's workshop bans, newest first, with the scope name resolved
   *
   * @param discordId - Discord ID of the banned user
   * @param includeInactive - Include lifted and elapsed bans
   * @returns Promise resolving to the user's workshop bans
   */
  async listForUser(
    discordId: string,
    includeInactive: boolean,
  ): Promise<WorkshopBanWithScope[]> {
    const activeOnly = `
      AND b.unbanned = false
      AND (
        b.expires_at IS NULL OR
        b.expires_at > NOW()
      )`;

    const query = `
      SELECT b.*, w.name AS workshop_name
      FROM ${this.table} b
      LEFT JOIN workshop w ON w.id = b.workshop_id
      WHERE b.discord_id = $1${includeInactive ? "" : activeOnly}
      ORDER BY b.banned_at DESC`;

    const result = await this.runQuery<
      WorkshopBanRow & { workshop_name: string | null }
    >("list workshop bans for user", query, [discordId]);

    return result.rows.map((row) => ({
      ...this.mapRowToEntity(row),
      workshopName: row.workshop_name,
    }));
  }
}
