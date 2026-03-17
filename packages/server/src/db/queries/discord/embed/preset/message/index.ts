import type { Pool, PoolClient } from "pg";
import { DiscordEmbedPresetMessageBaseQueries } from "@/generated/db/discord_embed_preset_message.queries";

/**
 * Custom queries for discord_embed_preset_message table
 * 
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class DiscordEmbedPresetMessageQueries extends DiscordEmbedPresetMessageBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<DiscordEmbedPresetMessage[]> {
  //   const result = await this.db.query<DiscordEmbedPresetMessage>(
  //     `SELECT * FROM discord_embed_preset_message WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
