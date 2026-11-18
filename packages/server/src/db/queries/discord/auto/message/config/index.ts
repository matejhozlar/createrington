import type { Pool, PoolClient } from "pg";
import { DiscordAutoMessageConfigBaseQueries } from "@/generated/db/discord_auto_message_config.queries";

export class DiscordAutoMessageConfigQueries extends DiscordAutoMessageConfigBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }
}
