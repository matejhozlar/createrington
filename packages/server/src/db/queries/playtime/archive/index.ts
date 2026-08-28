import type { Pool, PoolClient } from "pg";
import { PlaytimeArchiveBaseQueries } from "@/generated/db/playtime_archive.queries";

/**
 * Custom queries for playtime_archive table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export interface PlaytimeArchiveTotals {
  totalSeconds: number;
  totalSessions: number;
  playerCount: number;
  hours: number;
}

export class PlaytimeArchiveQueries extends PlaytimeArchiveBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /** Summed totals across every retired season, with hours floored to match the live playtime figures. */
  async getTotals(): Promise<PlaytimeArchiveTotals> {
    const query = `
      SELECT
        COALESCE(SUM(total_seconds), 0) AS total_seconds,
        COALESCE(SUM(total_sessions), 0) AS total_sessions,
        COALESCE(SUM(player_count), 0) AS player_count,
        FLOOR(COALESCE(SUM(total_seconds), 0) / 3600) AS hours
      FROM ${this.table}`;

    const result = await this.runQuery<{
      total_seconds: string;
      total_sessions: string;
      player_count: string;
      hours: string;
    }>("get archive totals", query);

    const row = result.rows[0];

    return {
      totalSeconds: Number(row.total_seconds),
      totalSessions: Number(row.total_sessions),
      playerCount: Number(row.player_count),
      hours: Number(row.hours),
    };
  }
}
