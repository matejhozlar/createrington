import type { Pool, PoolClient } from "pg";
import { DiscordTopRoleBaseQueries } from "@/generated/db/discord_top_role.queries";

export class DiscordTopRoleQueries extends DiscordTopRoleBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }
}
