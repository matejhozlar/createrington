import { Pool, type PoolClient } from "pg";
import type {
  Player,
  PlayerFilters,
  PlayerRow,
} from "@createrington/shared/db";
import { PlayerBaseQueries } from "@/generated/db/player.queries";
import type { Granularity } from "@/db/utils";
import { ACTIVE_BAN_WHERE } from "./ban/sql";
import { DatabaseTable as T } from "@/generated/db/constants";

interface DiscordIdReference {
  table: string;
  column: string;
  uniqueWith?: string[];
}

const DISCORD_ID_REFERENCES: DiscordIdReference[] = [
  { table: T.TICKET.TABLE, column: T.TICKET.FIELDS.CREATOR_DISCORD_ID },
  { table: T.DONATION.TABLE, column: T.DONATION.FIELDS.PLAYER_DISCORD_ID },
  {
    table: T.WAITLIST_ENTRY.TABLE,
    column: T.WAITLIST_ENTRY.FIELDS.DISCORD_ID,
    uniqueWith: [],
  },
  { table: T.WORKSHOP_MOD.TABLE, column: T.WORKSHOP_MOD.FIELDS.SUBMITTED_BY },
  {
    table: T.WORKSHOP_MOD_UPVOTE.TABLE,
    column: T.WORKSHOP_MOD_UPVOTE.FIELDS.DISCORD_ID,
    uniqueWith: [T.WORKSHOP_MOD_UPVOTE.FIELDS.WORKSHOP_MOD_ID],
  },
  {
    table: T.WORKSHOP_POLL_BALLOT.TABLE,
    column: T.WORKSHOP_POLL_BALLOT.FIELDS.DISCORD_ID,
    uniqueWith: [
      T.WORKSHOP_POLL_BALLOT.FIELDS.POLL_ID,
      T.WORKSHOP_POLL_BALLOT.FIELDS.POLL_MOD_ID,
    ],
  },
  { table: T.WORKSHOP_BAN.TABLE, column: T.WORKSHOP_BAN.FIELDS.DISCORD_ID },
  {
    table: T.STRUCTURE_PACK_BOOST.TABLE,
    column: T.STRUCTURE_PACK_BOOST.FIELDS.DISCORD_ID,
  },
  {
    table: T.PLAYER_PROMPT_RESPONSE.TABLE,
    column: T.PLAYER_PROMPT_RESPONSE.FIELDS.DISCORD_ID,
    uniqueWith: [
      T.PLAYER_PROMPT_RESPONSE.FIELDS.PROMPT_ID,
      T.PLAYER_PROMPT_RESPONSE.FIELDS.ENTRY_NUMBER,
    ],
  },
];

function reassignDiscordIdSql({
  table,
  column,
  uniqueWith,
}: DiscordIdReference): string {
  const sql = `UPDATE ${table} AS moved SET ${column} = $2 WHERE moved.${column} = $1`;
  if (!uniqueWith) return sql;
  const sameKey = uniqueWith
    .map((key) => ` AND kept.${key} IS NOT DISTINCT FROM moved.${key}`)
    .join("");
  return `${sql} AND NOT EXISTS (SELECT 1 FROM ${table} AS kept WHERE kept.${column} = $2${sameKey})`;
}

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
  async getWithViolations(
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
   * Moves every row that refers to a player by plain-text Discord ID (tickets,
   * donations, waitlist, workshop, boosts, prompt answers) from one ID to
   * another. A row whose unique key already exists under the new ID stays
   * under the old one. Run it in the transaction that changes player.discord_id.
   */
  async reassignDiscordId(from: string, to: string): Promise<void> {
    for (const reference of DISCORD_ID_REFERENCES) {
      await this.runQuery(
        `reassign ${reference.table}.${reference.column}`,
        reassignDiscordIdSql(reference),
        [from, to],
      );
    }
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
