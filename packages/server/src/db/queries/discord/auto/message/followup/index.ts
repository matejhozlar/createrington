import type { Pool, PoolClient } from "pg";
import { DiscordAutoMessageFollowupBaseQueries } from "@/generated/db/discord_auto_message_followup.queries";

export class DiscordAutoMessageFollowupQueries extends DiscordAutoMessageFollowupBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }
}
