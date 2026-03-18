import type { Pool, PoolClient } from "pg";
import { DiscordCommandUsageBaseQueries } from "@/generated/db/discord_command_usage.queries";

export interface CommandUsageStat {
  commandName: string;
  count: number;
}

export class DiscordCommandUsageQueries extends DiscordCommandUsageBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  async topCommands(limit = 10): Promise<CommandUsageStat[]> {
    const result = await this.db.query<{ command_name: string; count: string }>(
      `SELECT command_name, COUNT(*)::text AS count
       FROM discord_command_usage
       GROUP BY command_name
       ORDER BY COUNT(*) DESC
       LIMIT $1`,
      [limit],
    );
    return result.rows.map((r) => ({
      commandName: r.command_name,
      count: Number(r.count),
    }));
  }

  async countToday(): Promise<number> {
    const result = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM discord_command_usage
       WHERE executed_at >= CURRENT_DATE`,
    );
    return Number(result.rows[0]?.count ?? 0);
  }
}
