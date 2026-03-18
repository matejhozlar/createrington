import type { Pool, PoolClient } from "pg";
import { DiscordEmbedPresetCategoryBaseQueries } from "@/generated/db/discord_embed_preset_category.queries";

/**
 * Custom queries for discord_embed_preset_category table
 * 
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class DiscordEmbedPresetCategoryQueries extends DiscordEmbedPresetCategoryBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<DiscordEmbedPresetCategory[]> {
  //   const result = await this.db.query<DiscordEmbedPresetCategory>(
  //     `SELECT * FROM discord_embed_preset_category WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
