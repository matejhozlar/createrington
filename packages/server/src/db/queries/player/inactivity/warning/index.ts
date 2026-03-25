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

export class PlayerInactivityWarningQueries extends PlayerInactivityWarningBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /**
   * Find players inactive for the given number of days who don't already
   * have an active (unresolved, unremoved) warning.
   * Also excludes players created within the inactivity window.
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
}
