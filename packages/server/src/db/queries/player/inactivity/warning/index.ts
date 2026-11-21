import type { Pool, PoolClient } from "pg";
import type { CamelCaseKeys } from "@createrington/shared/types";
import { PlayerInactivityWarningBaseQueries } from "@/generated/db/player_inactivity_warning.queries";
import { escapeLike } from "@/db/utils";

export type WarningStatus =
  "all" | "active" | "expired" | "resolved" | "removed";

export interface WarningRow {
  id: number;
  player_minecraft_uuid: string;
  warned_at: Date;
  warning_message_id: string | null;
  resolved_at: Date | null;
  removed_at: Date | null;
  minecraft_username: string | null;
  discord_id: string | null;
  last_seen: Date | null;
}

export interface WarningWithPlayerRow extends WarningRow {
  minecraft_username: string;
  discord_id: string;
  last_seen: Date;
}

export interface InactivePlayerRow {
  minecraft_uuid: string;
  minecraft_username: string;
  discord_id: string;
  last_seen: Date;
}

/**
 * Warning row joined with player data (nullable when the player record
 * was deleted as part of the removal flow).
 */
export type WarningListItem = CamelCaseKeys<WarningRow>;

export interface WarningStatusCounts {
  active: number;
  expired: number;
  resolvedInRetention: number;
  removedInRetention: number;
}

const WARNING_COLUMNS = `w.id, w.player_minecraft_uuid, w.warned_at, w.warning_message_id,
  w.resolved_at, w.removed_at, p.minecraft_username, p.discord_id, p.last_seen`;

const OPEN = "resolved_at IS NULL AND removed_at IS NULL";
const WITHIN_GRACE = "warned_at >= NOW() - ($1 || ' days')::interval";
const PAST_GRACE = "warned_at < NOW() - ($1 || ' days')::interval";
const WITHIN_RETENTION = (column: string) =>
  `${column} >= NOW() - ($2 || ' days')::interval`;

const STATUS_WHERE: Record<WarningStatus, string> = {
  active: `${OPEN} AND ${WITHIN_GRACE}`,
  expired: `${OPEN} AND ${PAST_GRACE}`,
  resolved: "resolved_at IS NOT NULL",
  removed: "removed_at IS NOT NULL",
  all: "TRUE",
};

const NOT_ADMIN_OR_EXEMPT = (uuidColumn: string) => `
  NOT EXISTS (SELECT 1 FROM admin a WHERE a.discord_id = p.discord_id)
  AND NOT EXISTS (
    SELECT 1 FROM player_inactivity_exemption e
    WHERE e.player_minecraft_uuid = ${uuidColumn}
  )`;

export class PlayerInactivityWarningQueries extends PlayerInactivityWarningBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /**
   * Find players inactive for the given number of days who don't already
   * have an active (unresolved, unremoved) warning.
   * Also excludes players created within the inactivity window, registered
   * admins (admins are never swept by inactivity), and exempted players.
   */
  async findInactivePlayers(inactiveDays: number) {
    const result = await this.runQuery<InactivePlayerRow>(
      "find inactive players",
      `SELECT p.minecraft_uuid, p.minecraft_username, p.discord_id, p.last_seen
       FROM player p
       WHERE p.last_seen < NOW() - ($1 || ' days')::interval
         AND p.created_at < NOW() - ($1 || ' days')::interval
         AND NOT EXISTS (
           SELECT 1 FROM ${this.table} w
           WHERE w.player_minecraft_uuid = p.minecraft_uuid AND ${OPEN}
         )
         AND ${NOT_ADMIN_OR_EXEMPT("p.minecraft_uuid")}
       ORDER BY p.last_seen ASC`,
      [inactiveDays],
    );
    return this.mapRowsToEntities(result.rows);
  }

  /**
   * Find active warnings whose grace period has expired.
   * Admins and exempted players are excluded defensively: even if a
   * warning row predates the exclusions in `findInactivePlayers`, it will
   * never be acted on by the removal phase.
   */
  async findExpiredWarnings(graceDays: number) {
    const result = await this.runQuery<WarningWithPlayerRow>(
      "find expired inactivity warnings",
      `SELECT ${WARNING_COLUMNS}
       FROM ${this.table} w
       INNER JOIN player p ON p.minecraft_uuid = w.player_minecraft_uuid
       WHERE ${OPEN} AND ${PAST_GRACE}
         AND ${NOT_ADMIN_OR_EXEMPT("w.player_minecraft_uuid")}
       ORDER BY w.warned_at ASC`,
      [graceDays],
    );
    return this.mapRowsToEntities(result.rows);
  }

  /**
   * Set the warning message ID on all active warnings that don't have one yet.
   * Used after sending the announcement embed to link warnings to their message.
   */
  async setMessageIdOnPending(messageId: string): Promise<void> {
    await this.runQuery(
      "set message id on pending inactivity warnings",
      `UPDATE ${this.table}
       SET warning_message_id = $1, updated_at = NOW()
       WHERE ${OPEN} AND warning_message_id IS NULL`,
      [messageId],
    );
  }

  /**
   * Resolve every active warning whose player has logged in since it was
   * issued. Returns the resolved warnings with the player's name.
   */
  async resolveReturned() {
    const result = await this.runQuery<{
      id: number;
      minecraft_username: string;
    }>(
      "resolve returned inactivity warnings",
      `UPDATE ${this.table} w
       SET resolved_at = NOW(), updated_at = NOW()
       FROM player p
       WHERE p.minecraft_uuid = w.player_minecraft_uuid
         AND ${OPEN}
         AND p.last_seen > w.warned_at
       RETURNING w.id, p.minecraft_username`,
    );
    return this.mapRowsToEntities(result.rows);
  }

  /**
   * Resolve every active (unresolved, unremoved) warning for a player.
   * Returns the number of warnings resolved.
   */
  async resolveActiveForPlayer(playerMinecraftUuid: string): Promise<number> {
    const result = await this.runQuery(
      "resolve active inactivity warnings for player",
      `UPDATE ${this.table}
       SET resolved_at = NOW(), updated_at = NOW()
       WHERE player_minecraft_uuid = $1 AND ${OPEN}`,
      [playerMinecraftUuid],
    );
    return result.rowCount ?? 0;
  }

  /**
   * Delete warnings that were resolved or removed more than `retentionDays`
   * ago. Active warnings are never touched. Returns the number of rows deleted.
   */
  async pruneClosed(retentionDays: number): Promise<number> {
    const result = await this.runQuery(
      "prune closed inactivity warnings",
      `DELETE FROM ${this.table}
       WHERE resolved_at < NOW() - ($1 || ' days')::interval
          OR removed_at < NOW() - ($1 || ' days')::interval`,
      [retentionDays],
    );
    return result.rowCount ?? 0;
  }

  /**
   * List warnings filtered by status, optionally searching by current
   * Minecraft username. Uses LEFT JOIN on player so "removed" rows still
   * return even after the player record has been deleted.
   *
   * Only one row per player is returned (the latest warning), so a player
   * who was resolved and later re-warned doesn't appear twice. `graceDays`
   * is only bound when the status clause references it (active/expired):
   * an unreferenced parameter makes Postgres fail with "could not
   * determine data type".
   *
   * @param params.status - Warning status to filter on
   * @param params.graceDays - Grace period in days (used for active/expired split)
   * @param params.search - Optional case-insensitive username substring
   * @param params.limit - Page size
   * @param params.offset - Row offset
   */
  async listByStatus(params: {
    status: WarningStatus;
    graceDays: number;
    search?: string;
    limit: number;
    offset: number;
  }): Promise<{ warnings: WarningListItem[]; total: number }> {
    const values: unknown[] =
      params.status === "active" || params.status === "expired"
        ? [params.graceDays]
        : [];
    let where = STATUS_WHERE[params.status];
    if (params.search) {
      values.push(escapeLike(params.search));
      where += ` AND p.minecraft_username ILIKE '%' || $${values.length} || '%'`;
    }
    const from = `FROM ${this.table} w
      LEFT JOIN player p ON p.minecraft_uuid = w.player_minecraft_uuid
      WHERE ${where}`;

    const [listResult, countResult] = await Promise.all([
      this.runQuery<WarningRow>(
        "list inactivity warnings by status",
        `SELECT * FROM (
           SELECT DISTINCT ON (w.player_minecraft_uuid) ${WARNING_COLUMNS}
           ${from}
           ORDER BY w.player_minecraft_uuid, w.warned_at DESC
         ) latest
         ORDER BY latest.warned_at DESC
         LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, params.limit, params.offset],
      ),
      this.runQuery<{ total: number }>(
        "count inactivity warnings by status",
        `SELECT COUNT(DISTINCT w.player_minecraft_uuid)::int AS total ${from}`,
        values,
      ),
    ]);

    return {
      warnings: this.mapRowsToEntities(listResult.rows),
      total: countResult.rows[0]?.total ?? 0,
    };
  }

  /**
   * Returns counts for stats cards: active (in grace), expired (past grace
   * and not yet cleaned up), and resolved/removed within the retention
   * window, i.e. the rows the prune phase has not deleted yet.
   */
  async countByStatus(
    graceDays: number,
    retentionDays: number,
  ): Promise<WarningStatusCounts> {
    const result = await this.runQuery<{
      active: number;
      expired: number;
      resolved_in_retention: number;
      removed_in_retention: number;
    }>(
      "count inactivity warnings by status",
      `SELECT
         (COUNT(*) FILTER (WHERE ${STATUS_WHERE.active}))::int AS active,
         (COUNT(*) FILTER (WHERE ${STATUS_WHERE.expired}))::int AS expired,
         (COUNT(*) FILTER (
           WHERE ${STATUS_WHERE.resolved} AND ${WITHIN_RETENTION("resolved_at")}
         ))::int AS resolved_in_retention,
         (COUNT(*) FILTER (
           WHERE ${STATUS_WHERE.removed} AND ${WITHIN_RETENTION("removed_at")}
         ))::int AS removed_in_retention
       FROM ${this.table}`,
      [graceDays, retentionDays],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Fetches a single warning joined with current player data. Returns
   * null fields for the player columns if the player record was deleted.
   */
  async findByIdWithPlayer(id: number): Promise<WarningListItem | null> {
    const result = await this.runQuery<WarningRow>(
      "find inactivity warning by id",
      `SELECT ${WARNING_COLUMNS}
       FROM ${this.table} w
       LEFT JOIN player p ON p.minecraft_uuid = w.player_minecraft_uuid
       WHERE w.id = $1`,
      [id],
    );
    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }
}
