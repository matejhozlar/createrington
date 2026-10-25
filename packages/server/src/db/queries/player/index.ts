import { Pool, type PoolClient } from "pg";
import type { Player, PlayerFilters } from "@createrington/shared/db";
import { PlayerBaseQueries } from "@/generated/db/player.queries";

export type ViolationRequirement = "strikes" | "bans" | "both" | "either";

const ACTIVE_STRIKE_EXISTS = `EXISTS (
  SELECT 1 FROM player_strike s
  WHERE s.player_minecraft_uuid = player.minecraft_uuid AND s.removed = false
)`;

const ACTIVE_BAN_EXISTS = `EXISTS (
  SELECT 1 FROM player_ban b
  WHERE b.player_minecraft_uuid = player.minecraft_uuid
    AND b.unbanned = false
    AND (b.expires_at IS NULL OR b.expires_at > NOW())
)`;

const VIOLATION_CONDITIONS: Record<ViolationRequirement, string> = {
  strikes: ACTIVE_STRIKE_EXISTS,
  bans: ACTIVE_BAN_EXISTS,
  both: `${ACTIVE_STRIKE_EXISTS} AND ${ACTIVE_BAN_EXISTS}`,
  either: `(${ACTIVE_STRIKE_EXISTS} OR ${ACTIVE_BAN_EXISTS})`,
};

/**
 * Custom queries for player table
 *
 * - Inherits standard CRUD from PlayerBaseQueries
 * - Adds registration analytics (getRegistrationsByPeriod)
 * - Adds whitelist entry generation (getWhitelistEntries)
 */
export class PlayerQueries extends PlayerBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /**
   * One page of players matching `filters` that also carry the required
   * active violations, with the total matching count.
   */
  async listWithViolations(
    filters: PlayerFilters,
    violation: ViolationRequirement,
    options: {
      limit: number;
      offset: number;
      orderBy: keyof Player;
      orderDirection: "asc" | "desc";
    },
  ): Promise<{ rows: Player[]; total: number }> {
    const { whereClause, params } = this.buildFilterClause(filters);
    const where = `${whereClause} AND ${VIOLATION_CONDITIONS[violation]}`;
    const orderColumn = this.getColumnName(options.orderBy as string);
    const direction = options.orderDirection === "desc" ? "DESC" : "ASC";

    const [rows, count] = await Promise.all([
      this.runQuery(
        "list players with violations",
        `SELECT * FROM ${this.table}
         WHERE ${where}
         ORDER BY ${orderColumn} ${direction}
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, options.limit, options.offset],
      ),
      this.runQuery<{ total: string }>(
        "count players with violations",
        `SELECT COUNT(*) AS total FROM ${this.table} WHERE ${where}`,
        params,
      ),
    ]);
    return {
      rows: this.mapRowsToEntities(rows.rows),
      total: Number(count.rows[0]?.total ?? 0),
    };
  }

  /**
   * Get whitelist entries for every registered player without an active ban,
   * shaped to match Minecraft's whitelist.json format.
   *
   * @returns Array of { uuid, name }, ordered by username
   */
  async getWhitelistEntries(): Promise<Array<{ uuid: string; name: string }>> {
    const query = `
      SELECT minecraft_uuid AS uuid, minecraft_username AS name
      FROM ${this.table}
      WHERE minecraft_uuid NOT IN (
        SELECT player_minecraft_uuid
        FROM player_ban
        WHERE unbanned = false
          AND (expires_at IS NULL OR expires_at > NOW())
      )
      ORDER BY minecraft_username`;

    const result = await this.runQuery<{ uuid: string; name: string }>(
      "get whitelist entries",
      query,
    );
    return result.rows;
  }

  /**
   * Get player registrations grouped by time period
   *
   * Counts new player records by their created_at timestamp.
   *
   * @param start - Start of the date range (inclusive)
   * @param end - End of the date range (exclusive)
   * @param granularity - Bucketing interval: "day", "week", or "month"
   * @returns Array of periods with registration counts
   */
  async getRegistrationsByPeriod(
    start: Date,
    end: Date,
    granularity: "day" | "week" | "month" = "day",
  ): Promise<Array<{ period: string; count: number }>> {
    const query = `
      SELECT
        DATE_TRUNC($3, created_at)::text AS period,
        COUNT(*)::integer AS count
      FROM ${this.table}
      WHERE created_at >= $1 AND created_at < $2
      GROUP BY 1
      ORDER BY 1`;

    const result = await this.runQuery<{ period: string; count: number }>(
      "get registrations by period",
      query,
      [start, end, granularity],
    );
    return result.rows;
  }
}
