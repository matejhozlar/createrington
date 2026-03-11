import type { Pool, PoolClient } from "pg";
import { DiscordEmbedPresetBaseQueries } from "@/generated/db/discord_embed_preset.queries";

/**
 * Custom queries for discord_embed_preset table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class DiscordEmbedPresetQueries extends DiscordEmbedPresetBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add your custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<DiscordEmbedPreset[]> {
  //   const result = await this.db.query<DiscordEmbedPreset>(
  //     `SELECT * FROM discord_embed_preset WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
