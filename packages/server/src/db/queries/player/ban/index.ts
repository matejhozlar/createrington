import type { Pool, PoolClient } from "pg";
import { PlayerBanBaseQueries } from "@/generated/db/player_ban.queries";
import type { PlayerBan, BanType } from "@createrington/shared/db";
import { DatabaseTable } from "@/generated/db";

export interface BanStatistics {
  total: number;
  active: number;
  unbanned: number;
  temporary: number;
  permanent: number;
  expired: number;
}

/**
 * Custom queries for player_ban table
 *
 * - Active ban detection (considers both expiry and unbanned flag)
 * - Ban history, statistics, and moderator activity reports
 * - Bulk active ban counts for list views
 * - Expired ban discovery for cleanup jobs
 */
export class PlayerBanQueries extends PlayerBanBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /**
   * Get ban counts grouped by time period
   *
   * Aggregates bans into buckets with a total count plus
   * breakdowns by temporary and permanent ban types.
   *
   * @param start - Start of the date range (inclusive)
   * @param end - End of the date range (exclusive)
   * @param granularity - Bucketing interval: "day", "week", or "month"
   * @returns Array of periods with total, temporary, and permanent counts
   */
  async getCountsByPeriod(
    start: Date,
    end: Date,
    granularity: "day" | "week" | "month" = "day",
  ): Promise<
    Array<{
      period: string;
      total: number;
      temporary: number;
      permanent: number;
    }>
  > {
    const query = `
      SELECT
        DATE_TRUNC($3, banned_at)::text AS period,
        COUNT(*)::integer AS total,
        COUNT(*) FILTER (WHERE ban_type = 'temporary')::integer AS temporary,
        COUNT(*) FILTER (WHERE ban_type = 'permanent')::integer AS permanent
      FROM ${this.table}
      WHERE banned_at >= $1 AND banned_at < $2
      GROUP BY 1
      ORDER BY 1`;

    try {
      const result = await this.db.query<{
        period: string;
        total: number;
        temporary: number;
        permanent: number;
      }>(query, [start, end, granularity]);
      return result.rows;
    } catch (error) {
      logger.error("Failed to get ban counts by period:", error);
      throw error;
    }
  }

  /**
   * Get moderator activity ranked by ban count
   *
   * Groups all bans by the issuing admin and returns them
   * sorted by total bans descending.
   *
   * @param limit - Maximum number of moderators to return
   * @returns Array of moderators with their Discord ID, username, and ban count
   */
  async getModeratorActivity(
    limit: number = 10,
  ): Promise<Array<{ discordId: string; username: string; banCount: number }>> {
    const query = `
      SELECT
        banned_by_discord_id AS discord_id,
        banned_by_username AS username,
        COUNT(*)::integer AS ban_count
      FROM ${this.table}
      GROUP BY banned_by_discord_id, banned_by_username
      ORDER BY ban_count DESC
      LIMIT $1`;

    try {
      const result = await this.db.query<{
        discord_id: string;
        username: string;
        ban_count: number;
      }>(query, [limit]);

      return result.rows.map((row) => ({
        discordId: row.discord_id,
        username: row.username,
        banCount: row.ban_count,
      }));
    } catch (error) {
      logger.error("Failed to get moderator activity:", error);
      throw error;
    }
  }

  /**
   * Check if a player is currently banned
   *
   * @param playerMinecraftUuid - Player Minecraft UUID
   * @returns Promise resolving to true if player has any active ban
   */
  async isPlayerBanned(playerMinecraftUuid: string): Promise<boolean> {
    const query = `
      SELECT EXISTS(
        SELECT 1 FROM ${this.table}
        WHERE player_minecraft_uuid = $1
          AND unbanned = false
          AND (
            expires_at IS NULL OR
            expires_at > NOW()
          )
      ) as is_banned`;

    try {
      const result = await this.db.query<{ is_banned: boolean }>(query, [
        playerMinecraftUuid,
      ]);
      return result.rows[0]?.is_banned || false;
    } catch (error) {
      logger.error("Failed to check if player is banned:", error);
      throw error;
    }
  }

  /**
   * Get the most recent active ban for a player
   *
   * @param playerMinecraftUuid - Player Minecraft UUID
   * @returns Promise resolving to the active ban or null
   */
  async getCurrentBan(playerMinecraftUuid: string): Promise<PlayerBan | null> {
    const query = `
      SELECT * FROM ${this.table}
      WHERE player_minecraft_uuid = $1
        AND unbanned = false
        AND (
          expires_at IS NULL OR
          expires_at > NOW()
        )
      ORDER BY banned_at DESC
      LIMIT 1`;

    try {
      const result = await this.db.query<PlayerBan>(query, [
        playerMinecraftUuid,
      ]);
      return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
    } catch (error) {
      logger.error("Failed to get current ban:", error);
      throw error;
    }
  }

  /**
   * Get complete ban history for a player (including unbanned)
   *
   * @param playerMinecraftUuid - Player Minecraft UUID
   * @param includeUnbanned - Whether to include unbanned entries (default: true)
   * @returns Promise resolving to array of bans
   */
  async getBanHistory(
    playerMinecraftUuid: string,
    includeUnbanned: boolean = true,
  ): Promise<PlayerBan[]> {
    const filters = includeUnbanned
      ? { playerMinecraftUuid }
      : { playerMinecraftUuid, unbanned: false };

    return await this.findAll(filters, {
      orderBy: DatabaseTable.PLAYER_BAN.CAMEL_FIELDS.BANNED_AT,
      orderDirection: "desc",
    });
  }

  /**
   * Get ban statistics for a player
   *
   * @param playerMinecraftUuid - Player Minecraft UUID
   * @returns Promise resolving to ban statistics
   */
  async getPlayerStatistics(
    playerMinecraftUuid: string,
  ): Promise<BanStatistics> {
    const allBans = await this.findAll({ playerMinecraftUuid });
    const now = new Date();

    const stats = {
      total: allBans.length,
      active: 0,
      unbanned: 0,
      temporary: 0,
      permanent: 0,
      expired: 0,
    };

    for (const ban of allBans) {
      if (ban.unbanned) {
        stats.unbanned++;
      } else if (ban.expiresAt && ban.expiresAt <= now) {
        stats.expired++;
      } else {
        stats.active++;
      }

      if (ban.banType === "temporary") {
        stats.temporary++;
      } else {
        stats.permanent++;
      }
    }

    return stats;
  }

  /**
   * Get all expired temporary bans that haven't been marked as unbanned
   * Useful for cleanup jobs
   *
   * @returns Promise resolving to array of expired bans
   */
  async getExpiredBans(): Promise<PlayerBan[]> {
    const query = `
      SELECT * FROM ${this.table}
      WHERE ban_type = 'temporary'
        AND unbanned = false
        AND expires_at IS NOT NULL
        AND expires_at <= NOW()
      ORDER BY expires_at ASC`;

    try {
      const result = await this.db.query<PlayerBan>(query);
      return this.mapRowsToEntities(result.rows);
    } catch (error) {
      logger.error("Failed to get expired bans:", error);
      throw error;
    }
  }

  /**
   * Get all bans by type
   *
   * @param banType - Type of ban to retrieve
   * @param activeOnly - Whether to only include active bans
   * @returns Promise resolving to array of bans
   */
  async getByType(
    banType: BanType,
    activeOnly: boolean = true,
  ): Promise<PlayerBan[]> {
    if (activeOnly) {
      const query = `
        SELECT * FROM ${this.table}
        WHERE ban_type = $1
          AND unbanned = false
          AND (
            expires_at IS NULL OR
            expires_at > NOW()
          )
        ORDER BY banned_at DESC`;

      try {
        const result = await this.db.query<PlayerBan>(query, [banType]);
        return this.mapRowsToEntities(result.rows);
      } catch (error) {
        logger.error("Failed to get bans by type:", error);
        throw error;
      }
    }

    return await this.findAll(
      { banType },
      {
        orderBy: DatabaseTable.PLAYER_BAN.CAMEL_FIELDS.BANNED_AT,
        orderDirection: "desc",
      },
    );
  }

  /**
   * Get all bans issued by a specific admin
   *
   * @param adminDiscordId - Discord ID of the admin
   * @returns Promise resolving to array of bans
   */
  async getByAdmin(adminDiscordId: string): Promise<PlayerBan[]> {
    return await this.findAll(
      { bannedByDiscordId: adminDiscordId },
      {
        orderBy: DatabaseTable.PLAYER_BAN.CAMEL_FIELDS.BANNED_AT,
        orderDirection: "desc",
      },
    );
  }

  /**
   * Get recent bans across all players
   *
   * @param limit - Maximum number of bans to return
   * @param activeOnly - Whether to only include active bans
   * @returns Promise resolving to array of recent bans
   */
  async getRecent(
    limit: number = 50,
    activeOnly: boolean = true,
  ): Promise<PlayerBan[]> {
    if (activeOnly) {
      const query = `
        SELECT * FROM ${this.table}
        WHERE unbanned = false
          AND (
            expires_at IS NULL OR
            expires_at > NOW()
          )
        ORDER BY banned_at DESC
        LIMIT $1`;

      try {
        const result = await this.db.query<PlayerBan>(query, [limit]);
        return this.mapRowsToEntities(result.rows);
      } catch (error) {
        logger.error("Failed to get recent bans:", error);
        throw error;
      }
    }

    return await this.findAll(undefined, {
      limit,
      orderBy: DatabaseTable.PLAYER_BAN.CAMEL_FIELDS.BANNED_AT,
      orderDirection: "desc",
    });
  }

  /**
   * Count active bans for multiple players in a single query
   * Optimized for bulk operations
   *
   * @param playerUuids - Array of player UUIDs
   * @returns Promise resolving to map of UUID -> active ban count
   */
  async getActiveBanCounts(
    playerUuids: string[],
  ): Promise<Record<string, number>> {
    if (playerUuids.length === 0) return {};

    const query = `
      SELECT 
        player_minecraft_uuid,
        COUNT(*)::integer as count
      FROM ${this.table}
      WHERE 
        player_minecraft_uuid = ANY($1)
        AND unbanned = false
        AND (
          expires_at IS NULL OR
          expires_at > NOW()
        )
      GROUP BY player_minecraft_uuid`;

    try {
      const result = await this.db.query<{
        player_minecraft_uuid: string;
        count: number;
      }>(query, [playerUuids]);

      const counts: Record<string, number> = {};

      playerUuids.forEach((uuid) => {
        counts[uuid] = 0;
      });

      result.rows.forEach((row) => {
        counts[row.player_minecraft_uuid] = row.count;
      });

      return counts;
    } catch (error) {
      logger.error("Failed to get active ban counts:", error);
      throw error;
    }
  }

  /**
   * Get all player UUIDs that have active bans
   *
   * @returns Promise resolving to array of player UUIDs
   */
  async getPlayersWithActiveBans(): Promise<string[]> {
    const query = `
      SELECT DISTINCT player_minecraft_uuid
      FROM ${this.table}
      WHERE unbanned = false
        AND (
          expires_at IS NULL OR
          expires_at > NOW()
        )`;

    try {
      const result = await this.db.query<{ player_minecraft_uuid: string }>(
        query,
      );
      return result.rows.map((row) => row.player_minecraft_uuid);
    } catch (error) {
      logger.error("Failed to get players with active bans:", error);
      throw error;
    }
  }
}
