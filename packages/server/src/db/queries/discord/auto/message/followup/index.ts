import type { Pool, PoolClient } from "pg";
import { DiscordAutoMessageFollowupBaseQueries } from "@/generated/db/discord_auto_message_followup.queries";

/**
 * Custom queries for discord_auto_message_followup table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class DiscordAutoMessageFollowupQueries extends DiscordAutoMessageFollowupBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<DiscordAutoMessageFollowup[]> {
  //   const result = await this.db.query<DiscordAutoMessageFollowup>(
  //     `SELECT * FROM discord_auto_message_followup WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
