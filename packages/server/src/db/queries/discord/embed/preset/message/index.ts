import type { Pool, PoolClient } from "pg";
import { DiscordEmbedPresetMessageBaseQueries } from "@/generated/db/discord_embed_preset_message.queries";

export class DiscordEmbedPresetMessageQueries extends DiscordEmbedPresetMessageBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }
}
