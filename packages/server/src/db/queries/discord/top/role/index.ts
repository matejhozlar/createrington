import type { Pool, PoolClient } from "pg";
import { DiscordTopRoleBaseQueries } from "@/generated/db/discord_top_role.queries";

/**
 * Custom queries for discord_top_role table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class DiscordTopRoleQueries extends DiscordTopRoleBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<DiscordTopRole[]> {
  //   const result = await this.db.query<DiscordTopRole>(
  //     `SELECT * FROM discord_top_role WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
