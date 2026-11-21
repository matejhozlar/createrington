import type { Pool, PoolClient } from "pg";
import type { CamelCaseKeys } from "@createrington/shared/types";
import { DiscordCommandUsageBaseQueries } from "@/generated/db/discord_command_usage.queries";

export interface CommandUsageStatRow {
  command_name: string;
  count: number;
}

export type CommandUsageStat = CamelCaseKeys<CommandUsageStatRow>;

export class DiscordCommandUsageQueries extends DiscordCommandUsageBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  async topCommands(limit = 10): Promise<CommandUsageStat[]> {
    const result = await this.runQuery<CommandUsageStatRow>(
      "get top commands",
      `SELECT command_name, COUNT(*)::int AS count
       FROM ${this.table}
       GROUP BY command_name
       ORDER BY COUNT(*) DESC
       LIMIT $1`,
      [limit],
    );
    return this.mapRowsToEntities(result.rows);
  }

  async countToday(): Promise<number> {
    const result = await this.runQuery<{ count: number }>(
      "count commands today",
      `SELECT COUNT(*)::int AS count
       FROM ${this.table}
       WHERE executed_at >= CURRENT_DATE`,
    );
    return result.rows[0]?.count ?? 0;
  }
}
