import type { Pool, PoolClient } from "pg";
import type { DiscordTopRoleReign } from "@createrington/shared/db";
import { DiscordTopRoleReignBaseQueries } from "@/generated/db/discord_top_role_reign.queries";

export class DiscordTopRoleReignQueries extends DiscordTopRoleReignBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /** The current reign of a role, or `null` while nobody holds it. */
  async findOpen(roleKey: string): Promise<DiscordTopRoleReign | null> {
    const [open] = await this.findAll({ roleKey, endedAt: null }, { limit: 1 });
    return open ?? null;
  }
}
