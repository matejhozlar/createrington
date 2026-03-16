import type { Pool, PoolClient } from "pg";
import { DiscordAutoMessageConfigBaseQueries } from "@/generated/db/discord_auto_message_config.queries";

/**
 * Custom queries for discord_auto_message_config table
 * 
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class DiscordAutoMessageConfigQueries extends DiscordAutoMessageConfigBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<DiscordAutoMessageConfig[]> {
  //   const result = await this.db.query<DiscordAutoMessageConfig>(
  //     `SELECT * FROM discord_auto_message_config WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
