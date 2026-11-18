import type { Pool, PoolClient } from "pg";
import { DiscordStickyMessageBaseQueries } from "@/generated/db/discord_sticky_message.queries";

export class DiscordStickyMessageQueries extends DiscordStickyMessageBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }
}
