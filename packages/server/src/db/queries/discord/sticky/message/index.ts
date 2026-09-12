import type { Pool, PoolClient } from "pg";
import { DiscordStickyMessageBaseQueries } from "@/generated/db/discord_sticky_message.queries";

/**
 * Custom queries for discord_sticky_message table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class DiscordStickyMessageQueries extends DiscordStickyMessageBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<DiscordStickyMessage[]> {
  //   const result = await this.db.query<DiscordStickyMessage>(
  //     `SELECT * FROM discord_sticky_message WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
