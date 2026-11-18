import type { Pool, PoolClient } from "pg";
import { PlaytimeArchiveBaseQueries } from "@/generated/db/playtime_archive.queries";

export class PlaytimeArchiveQueries extends PlaytimeArchiveBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /** Hours across every retired season, floored once from the summed seconds to match the live playtime figures. */
  async getTotalHours(): Promise<number> {
    const query = `
      SELECT FLOOR(COALESCE(SUM(total_seconds), 0) / 3600) AS total_hours
      FROM ${this.table}`;

    const result = await this.runQuery<{ total_hours: string }>(
      "get archive total hours",
      query,
    );

    return Number(result.rows[0].total_hours);
  }
}
