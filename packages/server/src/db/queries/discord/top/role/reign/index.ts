import type { Pool, PoolClient } from "pg";
import type { DiscordTopRoleReign } from "@createrington/shared/db";
import { DiscordTopRoleReignBaseQueries } from "@/generated/db/discord_top_role_reign.queries";

/**
 * Custom queries for discord_top_role_reign table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class DiscordTopRoleReignQueries extends DiscordTopRoleReignBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /** The current reign of a role, or `null` while nobody holds it. */
  async findOpen(roleKey: string): Promise<DiscordTopRoleReign | null> {
    const [open] = await this.findAll({ roleKey, endedAt: null }, { limit: 1 });
    return open ?? null;
  }

  /** Longest reign per role, an open reign counting up to now; ties go to the earlier reign. */
  async getLongest(): Promise<DiscordTopRoleReign[]> {
    const result = await this.runQuery(
      "list longest reign per role",
      `SELECT DISTINCT ON (role_key) *
       FROM ${this.table}
       ORDER BY role_key, COALESCE(ended_at, now()) - started_at DESC, started_at`,
    );
    return this.mapRowsToEntities(result.rows);
  }
}
