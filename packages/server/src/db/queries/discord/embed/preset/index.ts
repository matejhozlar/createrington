import type { Pool, PoolClient } from "pg";
import { DiscordEmbedPresetBaseQueries } from "@/generated/db/discord_embed_preset.queries";

export class DiscordEmbedPresetQueries extends DiscordEmbedPresetBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }
}
