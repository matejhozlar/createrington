import { Pool, type PoolClient } from "pg";
import type {
  Player,
  PlayerFilters,
  PlayerRow,
} from "@createrington/shared/db";
import { PlayerBaseQueries } from "@/generated/db/player.queries";
import type { Granularity } from "@/db/utils";
import { ACTIVE_BAN_WHERE } from "./ban/sql";

export type ViolationRequirement = "strikes" | "bans" | "both" | "either";

const ACTIVE_STRIKE_EXISTS = `EXISTS (
  SELECT 1 FROM player_strike s
  WHERE s.player_minecraft_uuid = player.minecraft_uuid AND s.removed = false
)`;

const ACTIVE_BAN_EXISTS = `EXISTS (
  SELECT 1 FROM player_ban b
  WHERE b.player_minecraft_uuid = player.minecraft_uuid AND ${ACTIVE_BAN_WHERE}
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
    const orderColumn = this.getColumnName(options.orderBy);
    const direction = options.orderDirection === "desc" ? "DESC" : "ASC";

    const [rows, count] = await Promise.all([
      this.runQuery<PlayerRow>(
        "list players with violations",
        `SELECT * FROM ${this.table}
         WHERE ${where}
         ORDER BY ${orderColumn} ${direction}
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, options.limit, options.offset],
      ),
      this.runQuery<{ total: number }>(
        "count players with violations",
        `SELECT COUNT(*)::int AS total FROM ${this.table} WHERE ${where}`,
        params,
      ),
    ]);
    return {
      rows: this.mapRowsToEntities(rows.rows),
      total: count.rows[0]?.total ?? 0,
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
        SELECT player_minecraft_uuid FROM player_ban WHERE ${ACTIVE_BAN_WHERE}
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
    granularity: Granularity = "day",
  ): Promise<Array<{ period: string; count: number }>> {
    return this.aggregateByPeriod<{ count: number }>(
      "get registrations by period",
      "createdAt",
      { count: "COUNT(*)::int" },
      start,
      end,
      granularity,
    );
  }
}
