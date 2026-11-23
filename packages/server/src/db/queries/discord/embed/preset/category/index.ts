import type { Pool, PoolClient } from "pg";
import { DiscordEmbedPresetCategoryBaseQueries } from "@/generated/db/discord_embed_preset_category.queries";

export class DiscordEmbedPresetCategoryQueries extends DiscordEmbedPresetCategoryBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }
}
