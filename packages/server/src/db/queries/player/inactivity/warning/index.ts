import type { Pool, PoolClient } from "pg";
import { PlayerInactivityWarningBaseQueries } from "@/generated/db/player_inactivity_warning.queries";

interface InactivePlayer {
  minecraftUuid: string;
  minecraftUsername: string;
  discordId: string;
  lastSeen: Date;
}

interface ActiveWarning {
  id: number;
  playerMinecraftUuid: string;
  warnedAt: Date;
  warningMessageId: string | null;
  minecraftUsername: string;
  discordId: string;
  lastSeen: Date;
}

export type WarningStatus =
  | "all"
  | "active"
  | "expired"
  | "resolved"
  | "removed";

/**
 * Warning row joined with player data (nullable when the player record
 * was deleted as part of the removal flow).
 */
export interface WarningListItem {
  id: number;
  playerMinecraftUuid: string;
  warnedAt: Date;
  warningMessageId: string | null;
  resolvedAt: Date | null;
  removedAt: Date | null;
  minecraftUsername: string | null;
  discordId: string | null;
  lastSeen: Date | null;
}

export interface WarningStatusCounts {
  active: number;
  expired: number;
  resolvedLast30d: number;
  removedLast30d: number;
}

export class PlayerInactivityWarningQueries extends PlayerInactivityWarningBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /**
   * Find players inactive for the given number of days who don't already
   * have an active (unresolved, unremoved) warning.
   * Also excludes players created within the inactivity window and any
   * registered admins — admins are never swept by inactivity.
   */
  async findInactivePlayers(inactiveDays: number): Promise<InactivePlayer[]> {
    const query = `
      SELECT
        p.minecraft_uuid AS minecraft_uuid,
        p.minecraft_username AS minecraft_username,
        p.discord_id AS discord_id,
        p.last_seen AS last_seen
      FROM player p
      WHERE p.last_seen < NOW() - ($1 || ' days')::interval
        AND p.created_at < NOW() - ($1 || ' days')::interval
        AND NOT EXISTS (
          SELECT 1 FROM player_inactivity_warning w
          WHERE w.player_minecraft_uuid = p.minecraft_uuid
            AND w.resolved_at IS NULL
            AND w.removed_at IS NULL
        )
        AND NOT EXISTS (
          SELECT 1 FROM admin a WHERE a.discord_id = p.discord_id
        )
      ORDER BY p.last_seen ASC`;

    const result = await this.db.query<{
      minecraft_uuid: string;
      minecraft_username: string;
      discord_id: string;
      last_seen: Date;
    }>(query, [inactiveDays]);

    return result.rows.map((row) => ({
      minecraftUuid: row.minecraft_uuid,
      minecraftUsername: row.minecraft_username,
      discordId: row.discord_id,
      lastSeen: row.last_seen,
    }));
  }

  /**
   * Find all active warnings (not resolved, not removed) joined with player data.
   */
  async findActiveWarnings(): Promise<ActiveWarning[]> {
    const query = `
      SELECT
        w.id,
        w.player_minecraft_uuid,
        w.warned_at,
        w.warning_message_id,
        p.minecraft_username,
        p.discord_id,
        p.last_seen
      FROM player_inactivity_warning w
      INNER JOIN player p ON p.minecraft_uuid = w.player_minecraft_uuid
      WHERE w.resolved_at IS NULL
        AND w.removed_at IS NULL
      ORDER BY w.warned_at ASC`;

    const result = await this.db.query<{
      id: number;
      player_minecraft_uuid: string;
      warned_at: Date;
      warning_message_id: string | null;
      minecraft_username: string;
      discord_id: string;
      last_seen: Date;
    }>(query);

    return result.rows.map((row) => ({
      id: row.id,
      playerMinecraftUuid: row.player_minecraft_uuid,
      warnedAt: row.warned_at,
      warningMessageId: row.warning_message_id,
      minecraftUsername: row.minecraft_username,
      discordId: row.discord_id,
      lastSeen: row.last_seen,
    }));
  }

  /**
   * Find active warnings whose grace period has expired.
   * Admins are excluded defensively — even if a pre-existing warning
   * row predates the admin exclusion in `findInactivePlayers`, it will
   * never be acted on by the removal phase.
   */
  async findExpiredWarnings(graceDays: number): Promise<ActiveWarning[]> {
    const query = `
      SELECT
        w.id,
        w.player_minecraft_uuid,
        w.warned_at,
        w.warning_message_id,
        p.minecraft_username,
        p.discord_id,
        p.last_seen
      FROM player_inactivity_warning w
      INNER JOIN player p ON p.minecraft_uuid = w.player_minecraft_uuid
      WHERE w.resolved_at IS NULL
        AND w.removed_at IS NULL
        AND w.warned_at < NOW() - ($1 || ' days')::interval
        AND NOT EXISTS (
          SELECT 1 FROM admin a WHERE a.discord_id = p.discord_id
        )
      ORDER BY w.warned_at ASC`;

    const result = await this.db.query<{
      id: number;
      player_minecraft_uuid: string;
      warned_at: Date;
      warning_message_id: string | null;
      minecraft_username: string;
      discord_id: string;
      last_seen: Date;
    }>(query, [graceDays]);

    return result.rows.map((row) => ({
      id: row.id,
      playerMinecraftUuid: row.player_minecraft_uuid,
      warnedAt: row.warned_at,
      warningMessageId: row.warning_message_id,
      minecraftUsername: row.minecraft_username,
      discordId: row.discord_id,
      lastSeen: row.last_seen,
    }));
  }

  /**
   * Set the warning message ID on all active warnings that don't have one yet.
   * Used after sending the announcement embed to link warnings to their message.
   */
  async setMessageIdOnPending(messageId: string): Promise<void> {
    await this.db.query(
      `UPDATE player_inactivity_warning
       SET warning_message_id = $1, updated_at = NOW()
       WHERE resolved_at IS NULL
         AND removed_at IS NULL
         AND warning_message_id IS NULL`,
      [messageId],
    );
  }

  /**
   * Mark a warning as resolved (player returned).
   */
  async resolveWarning(id: number): Promise<void> {
    await this.db.query(
      `UPDATE player_inactivity_warning SET resolved_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [id],
    );
  }

  /**
   * Mark a warning as removed (player was kicked/deleted).
   */
  async markRemoved(id: number): Promise<void> {
    await this.db.query(
      `UPDATE player_inactivity_warning SET removed_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [id],
    );
  }

  /**
   * List warnings filtered by status, optionally searching by current
   * Minecraft username. Uses LEFT JOIN on player so "removed" rows still
   * return even after the player record has been deleted.
   *
   * Params are built dynamically: `graceDays` is only passed when the
   * status clause actually needs it (active/expired). Passing an unused
   * parameter would trigger Postgres "could not determine data type".
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
    // Status clause. `$1` references graceDays when pushed as the first
    // param (active/expired). For the other statuses no param is needed,
    // so we keep the SQL free of unreferenced placeholders.
    const needsGraceDays =
      params.status === "active" || params.status === "expired";

    let statusClause: string;
    switch (params.status) {
      case "active":
        statusClause = `w.resolved_at IS NULL AND w.removed_at IS NULL AND w.warned_at >= NOW() - ($1 || ' days')::interval`;
        break;
      case "expired":
        statusClause = `w.resolved_at IS NULL AND w.removed_at IS NULL AND w.warned_at < NOW() - ($1 || ' days')::interval`;
        break;
      case "resolved":
        statusClause = `w.resolved_at IS NOT NULL`;
        break;
      case "removed":
        statusClause = `w.removed_at IS NOT NULL`;
        break;
      case "all":
      default:
        statusClause = `TRUE`;
        break;
    }

    // List params: [graceDays?], limit, offset, [search?]
    const listParams: Array<string | number> = [];
    if (needsGraceDays) listParams.push(params.graceDays);

    listParams.push(params.limit);
    const limitParamIdx = listParams.length;
    listParams.push(params.offset);
    const offsetParamIdx = listParams.length;

    // Count params: [graceDays?], [search?]
    const countParams: Array<string | number> = [];
    if (needsGraceDays) countParams.push(params.graceDays);

    let listSearchClause = "";
    let countSearchClause = "";
    if (params.search) {
      listParams.push(params.search);
      listSearchClause = `AND p.minecraft_username ILIKE '%' || $${listParams.length} || '%'`;
      countParams.push(params.search);
      countSearchClause = `AND p.minecraft_username ILIKE '%' || $${countParams.length} || '%'`;
    }

    // Dedupe to one row per player (latest warning), so a player who
    // was resolved and later re-warned doesn't appear twice. The inner
    // DISTINCT ON must order by the partition key first, then warned_at
    // DESC to pick the most recent row. The outer query re-sorts by
    // warned_at DESC for pagination.
    const listQuery = `
      SELECT * FROM (
        SELECT DISTINCT ON (w.player_minecraft_uuid)
          w.id,
          w.player_minecraft_uuid,
          w.warned_at,
          w.warning_message_id,
          w.resolved_at,
          w.removed_at,
          p.minecraft_username,
          p.discord_id,
          p.last_seen
        FROM player_inactivity_warning w
        LEFT JOIN player p ON p.minecraft_uuid = w.player_minecraft_uuid
        WHERE ${statusClause}
          ${listSearchClause}
        ORDER BY w.player_minecraft_uuid, w.warned_at DESC
      ) latest
      ORDER BY latest.warned_at DESC
      LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx}`;

    const countQuery = `
      SELECT COUNT(DISTINCT w.player_minecraft_uuid)::integer AS total
      FROM player_inactivity_warning w
      LEFT JOIN player p ON p.minecraft_uuid = w.player_minecraft_uuid
      WHERE ${statusClause}
        ${countSearchClause}`;

    try {
      const [listResult, countResult] = await Promise.all([
        this.db.query<{
          id: number;
          player_minecraft_uuid: string;
          warned_at: Date;
          warning_message_id: string | null;
          resolved_at: Date | null;
          removed_at: Date | null;
          minecraft_username: string | null;
          discord_id: string | null;
          last_seen: Date | null;
        }>(listQuery, listParams),
        this.db.query<{ total: number }>(countQuery, countParams),
      ]);

      return {
        warnings: listResult.rows.map((row) => ({
          id: row.id,
          playerMinecraftUuid: row.player_minecraft_uuid,
          warnedAt: row.warned_at,
          warningMessageId: row.warning_message_id,
          resolvedAt: row.resolved_at,
          removedAt: row.removed_at,
          minecraftUsername: row.minecraft_username,
          discordId: row.discord_id,
          lastSeen: row.last_seen,
        })),
        total: countResult.rows[0]?.total ?? 0,
      };
    } catch (error) {
      logger.error("Error listing warnings by status:", error);
      throw error;
    }
  }

  /**
   * Returns counts for stats cards: active (in grace), expired (past grace
   * and not yet cleaned up), and resolved/removed in the last 30 days.
   */
  async countByStatus(graceDays: number): Promise<WarningStatusCounts> {
    const query = `
      SELECT
        COUNT(*) FILTER (
          WHERE resolved_at IS NULL
            AND removed_at IS NULL
            AND warned_at >= NOW() - ($1 || ' days')::interval
        )::integer AS active,
        COUNT(*) FILTER (
          WHERE resolved_at IS NULL
            AND removed_at IS NULL
            AND warned_at < NOW() - ($1 || ' days')::interval
        )::integer AS expired,
        COUNT(*) FILTER (
          WHERE resolved_at IS NOT NULL
            AND resolved_at >= NOW() - INTERVAL '30 days'
        )::integer AS resolved_last30d,
        COUNT(*) FILTER (
          WHERE removed_at IS NOT NULL
            AND removed_at >= NOW() - INTERVAL '30 days'
        )::integer AS removed_last30d
      FROM player_inactivity_warning`;

    try {
      const result = await this.db.query<{
        active: number;
        expired: number;
        resolved_last30d: number;
        removed_last30d: number;
      }>(query, [graceDays]);

      const row = result.rows[0];
      return {
        active: row?.active ?? 0,
        expired: row?.expired ?? 0,
        resolvedLast30d: row?.resolved_last30d ?? 0,
        removedLast30d: row?.removed_last30d ?? 0,
      };
    } catch (error) {
      logger.error("Error counting warnings by status:", error);
      throw error;
    }
  }

  /**
   * Fetches a single warning joined with current player data. Returns
   * null fields for the player columns if the player record was deleted.
   */
  async findByIdWithPlayer(id: number): Promise<WarningListItem | null> {
    const query = `
      SELECT
        w.id,
        w.player_minecraft_uuid,
        w.warned_at,
        w.warning_message_id,
        w.resolved_at,
        w.removed_at,
        p.minecraft_username,
        p.discord_id,
        p.last_seen
      FROM player_inactivity_warning w
      LEFT JOIN player p ON p.minecraft_uuid = w.player_minecraft_uuid
      WHERE w.id = $1
      LIMIT 1`;

    try {
      const result = await this.db.query<{
        id: number;
        player_minecraft_uuid: string;
        warned_at: Date;
        warning_message_id: string | null;
        resolved_at: Date | null;
        removed_at: Date | null;
        minecraft_username: string | null;
        discord_id: string | null;
        last_seen: Date | null;
      }>(query, [id]);

      if (result.rows.length === 0) return null;
      const row = result.rows[0];
      return {
        id: row.id,
        playerMinecraftUuid: row.player_minecraft_uuid,
        warnedAt: row.warned_at,
        warningMessageId: row.warning_message_id,
        resolvedAt: row.resolved_at,
        removedAt: row.removed_at,
        minecraftUsername: row.minecraft_username,
        discordId: row.discord_id,
        lastSeen: row.last_seen,
      };
    } catch (error) {
      logger.error("Error fetching warning by id:", error);
      throw error;
    }
  }
}
