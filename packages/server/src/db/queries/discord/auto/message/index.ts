import type { Pool, PoolClient } from "pg";
import { DiscordAutoMessageBaseQueries } from "@/generated/db/discord_auto_message.queries";

/**
 * Custom queries for discord_auto_message table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class DiscordAutoMessageQueries extends DiscordAutoMessageBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<DiscordAutoMessage[]> {
  //   const result = await this.db.query<DiscordAutoMessage>(
  //     `SELECT * FROM discord_auto_message WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
