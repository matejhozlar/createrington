import type { Pool, PoolClient } from "pg";
import { PlayerStrikeBaseQueries } from "@/generated/db/player_strike.queries";
import type {
  PlayerStrike,
  StrikeClassification,
} from "@createrington/shared/db";
import { DatabaseTable } from "@/generated/db";

export interface StrikeStatistics {
  total: number;
  active: number;
  removed: number;
  byClassification: Record<StrikeClassification, number>;
  bySeverity: Record<1 | 2 | 3 | 4 | 5, number>;
  mostRecent?: Date;
}

/**
 * Custom queries for player_strike table
 *
 * - Active vs removed strike tracking
 * - Statistics by classification, severity, and time period
 * - Bulk active strike counts for list views
 * - Moderator-scoped queries
 */
export class PlayerStrikeQueries extends PlayerStrikeBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /**
   * Get strike counts grouped by time period with classification breakdown
   *
   * Queries per-period + per-classification counts, then aggregates
   * in JS to build a nested { total, byClassification } structure.
   *
   * @param start - Start of the date range (inclusive)
   * @param end - End of the date range (exclusive)
   * @param granularity - Bucketing interval: "day", "week", or "month"
   * @returns Array of periods with total count and classification-keyed breakdown
   */
  async getCountsByPeriod(
    start: Date,
    end: Date,
    granularity: "day" | "week" | "month" = "day",
  ): Promise<
    Array<{
      period: string;
      total: number;
      byClassification: Record<string, number>;
    }>
  > {
    try {
      const rawQuery = `
        SELECT
          DATE_TRUNC($3, issued_at)::text AS period,
          classification,
          COUNT(*)::integer AS count
        FROM ${this.table}
        WHERE issued_at >= $1 AND issued_at < $2
        GROUP BY 1, classification
        ORDER BY 1`;

      const result = await this.db.query<{
        period: string;
        classification: string;
        count: number;
      }>(rawQuery, [start, end, granularity]);

      const periodMap = new Map<
        string,
        { total: number; byClassification: Record<string, number> }
      >();

      for (const row of result.rows) {
        if (!periodMap.has(row.period)) {
          periodMap.set(row.period, { total: 0, byClassification: {} });
        }
        const entry = periodMap.get(row.period)!;
        entry.total += row.count;
        entry.byClassification[row.classification] = row.count;
      }

      return Array.from(periodMap.entries()).map(([period, data]) => ({
        period,
        ...data,
      }));
    } catch (error) {
      logger.error("Failed to get strike counts by period:", error);
      throw error;
    }
  }

  /**
   * Get severity distribution for active (non-removed) strikes
   *
   * @returns Array of severity levels (1-5) with their active strike counts
   */
  async getSeverityDistribution(): Promise<
    Array<{ severity: number; count: number }>
  > {
    const query = `
      SELECT severity, COUNT(*)::integer AS count
      FROM ${this.table}
      WHERE removed = false
      GROUP BY severity
      ORDER BY severity`;

    try {
      const result = await this.db.query<{ severity: number; count: number }>(
        query,
      );
      return result.rows;
    } catch (error) {
      logger.error("Failed to get severity distribution:", error);
      throw error;
    }
  }

  /**
   * Get active strike counts for multiple players in a single query
   *
   * @param playerUuids - Array of player UUIDs to get counts for
   * @returns Promise resolving to a map of UUID -> active strike count
   */
  async getActiveStrikeCounts(
    playerUUids: string[],
  ): Promise<Record<string, number>> {
    if (playerUUids.length === 0) return {};

    const query = `
      SELECT 
        player_minecraft_uuid,
        COUNT(*)::integer as count
      FROM player_strike
      WHERE 
        player_minecraft_uuid = ANY($1)
        AND removed = false
      GROUP BY player_minecraft_uuid
      `;

    try {
      const result = await this.db.query<{
        player_minecraft_uuid: string;
        count: number;
      }>(query, [playerUUids]);

      const counts: Record<string, number> = {};

      playerUUids.forEach((uuid) => {
        counts[uuid] = 0;
      });

      result.rows.forEach((row) => {
        counts[row.player_minecraft_uuid] = row.count;
      });

      return counts;
    } catch (error) {
      logger.error("Failed to get active strike counts:", error);
      throw error;
    }
  }

  /**
   * Get complete strike history for a player (including removed)
   *
   * @param playerMinecraftUuid - Player Minecraft UUID to get all strikes for
   * @param includeRemoved - Whether to include removed strikes (default: true)
   * @returns Promise resolving to an array of player strikes
   */
  async getStrikeHistory(
    playerMinecraftUuid: string,
    includeRemoved: boolean = true,
  ): Promise<PlayerStrike[]> {
    const filters = includeRemoved
      ? { playerMinecraftUuid }
      : { playerMinecraftUuid, removed: false };

    return await this.findAll(filters, {
      orderBy: DatabaseTable.PLAYER_STRIKE.CAMEL_FIELDS.ISSUED_AT,
      orderDirection: "desc",
    });
  }

  /**
   * Get all player UUIDs that have active strikes
   *
   * @returns Promise resolving to array of player UUIDs
   */
  async getPlayersWithActiveStrikes(): Promise<string[]> {
    const query = `
      SELECT DISTINCT player_minecraft_uuid
      FROM ${this.table}
      WHERE removed = false`;

    try {
      const result = await this.db.query<{ player_minecraft_uuid: string }>(
        query,
      );
      return result.rows.map((row) => row.player_minecraft_uuid);
    } catch (error) {
      logger.error("Failed to get players with active strikes:", error);
      throw error;
    }
  }

  /**
   * Get strike statistics for a player
   *
   * @param playerMinecraftUuid - Player Minecraft UUID to get statistics for
   * @returns Promise resolving strike statistics
   */
  async getPlayerStatistics(
    playerMinecraftUuid: string,
  ): Promise<StrikeStatistics> {
    const allStrikes = await this.findAll({ playerMinecraftUuid });

    const stats: StrikeStatistics = {
      total: allStrikes.length,
      active: 0,
      removed: 0,
      byClassification: {
        pvp: 0,
        theft: 0,
        griefing: 0,
        laggy_machines: 0,
        inappropriate_chat: 0,
        harassment: 0,
        exploiting: 0,
        rule_violation: 0,
        other: 0,
      },
      bySeverity: {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
      },
    };

    for (const strike of allStrikes) {
      if (strike.removed) {
        stats.removed++;
      } else {
        stats.active++;
      }

      stats.byClassification[strike.classification as StrikeClassification]++;
      stats.bySeverity[strike.severity as 1 | 2 | 3 | 4 | 5]++;

      if (!stats.mostRecent || strike.issuedAt > stats.mostRecent) {
        stats.mostRecent = strike.issuedAt;
      }
    }

    return stats;
  }

  /**
   * Count active strikes for a player
   *
   * @param playerMinecraftUuid - Player Minecraft UUID to get count for
   * @returns Promise resolving to the number of active strikes
   */
  async countActiveStrikes(playerMinecraftUuid: string): Promise<number> {
    return await this.count({
      playerMinecraftUuid,
      removed: false,
    });
  }

  /**
   * Get all strikes issued by a specific admin
   *
   * @param adminDiscordid - Discord user ID of the admin
   * @returns Promise resolving to an array of player strikes
   */
  async getByAdmin(adminDiscordId: string): Promise<PlayerStrike[]> {
    return await this.findAll(
      { issuedByDiscordId: adminDiscordId },
      {
        orderBy: DatabaseTable.PLAYER_STRIKE.CAMEL_FIELDS.ISSUED_AT,
        orderDirection: "desc",
      },
    );
  }

  /**
   * Get recent strikes across all players
   *
   * @param limit - Number of maximum strikes to return
   * @param activeOnly - Whether to include only active strikes
   * @returns Promise resolving to an array of most recent strikes
   */
  async getRecent(
    limit: number = 50,
    activeOnly: boolean = true,
  ): Promise<PlayerStrike[]> {
    const filters = activeOnly ? { removed: false } : undefined;

    return await this.findAll(filters, {
      limit,
      orderBy: DatabaseTable.PLAYER_STRIKE.CAMEL_FIELDS.ISSUED_AT,
      orderDirection: "desc",
    });
  }
}
