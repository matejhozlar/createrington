import { Q } from "@/db";
import type { ServerActivity } from "@/db/queries/player/playtime/daily";
import type {
  PlayerHourlyPattern,
  ServerHeatMap,
} from "@/db/queries/player/playtime/hourly";
import type {
  LeaderboardEntry,
  ServerStats,
} from "@/db/queries/player/playtime/summary";
import type {
  PlayerPlaytimeDaily,
  PlayerPlaytimeHourly,
  PlayerPlaytimeSummary,
  PlayerSession,
} from "@/generated/db";
import { PlaytimeService } from "@/services/playtime";
import type { SessionEndEvent, SessionStartEvent } from "@/services/playtime";

/**
 * Repository for playtime data management
 *
 * Handles:
 * - Session lifecycle (start/end)
 * - Player state synchronization
 * - Playtime statistics and aggregations
 * - Coordinates multiple query classes
 *
 * This is the layer that listens to PlaytimeService events
 */
export class PlaytimeRepository {
  constructor() {}

  // ============================================================================
  // SESSION LIFECYCLE
  // ============================================================================

  /**
   * Start a new session for a player
   * Called when PlaytimeService emits 'sessionStart' event
   *
   * @param event - Session start event
   * @returns Session ID for tracking
   */
  async startSession(event: SessionStartEvent): Promise<number | null> {
    try {
      const player = await Q.player.find({
        minecraftUuid: event.uuid,
      });

      if (!player) {
        logger.debug(
          `Ignoring session start for unregistered player: ${event.username} (${event.uuid})`,
        );
        return null;
      }
      if (player.minecraftUsername !== event.username) {
        logger.debug(
          `Username for user ${event.username} does not check out with database entry` +
            `Database: ${player.minecraftUsername} (${player.minecraftUuid})` +
            `Event: ${event.username} (${event.uuid})`,
        );
        return null;
      }

      const session = await Q.player.session.createAndReturn({
        playerMinecraftUuid: event.uuid,
        serverId: event.serverId,
        sessionStart: event.sessionStart,
      });

      logger.info(
        `Session started: ${event.username} (${event.uuid}) - ID: ${session.id}`,
      );

      return session.id;
    } catch (error) {
      logger.error("Failed to start session:", error);
      throw error;
    }
  }

  /**
   * End a session
   * Called then PlaytimeService emits 'sessionEnd' event
   * Database triggers will handle aggregations automatically
   *
   * @param event - Session end event data
   */
  async endSession(event: SessionEndEvent): Promise<void> {
    try {
      await Q.player.session.update(
        { id: event.sessionId },
        { sessionEnd: event.sessionEnd },
      );

      logger.info(
        `Session ended: ${event.username} (${event.uuid}) - ${event.secondsPlayed}s`,
      );
    } catch (error) {
      logger.error("Failed to end session:", error);
      throw error;
    }
  }

  /**
   * Get active session for a player
   *
   * @param playerMinecraftUuid - Minecraft player UUID
   * @param serverId - Server ID
   */
  async getActiveSession(
    playerMinecraftUuid: string,
    serverId: number,
  ): Promise<PlayerSession | null> {
    try {
      const sessions = await Q.player.session.findAll({
        playerMinecraftUuid,
        serverId,
        sessionEnd: null,
      });
      return sessions[0] || null;
    } catch (error) {
      logger.error("Failed to get active session:", error);
      throw error;
    }
  }

  /**
   * Get all active sessions
   *
   * @param serverId - Optional server ID filter
   */
  async getActiveSessions(serverId?: number): Promise<PlayerSession[]> {
    try {
      return await Q.player.session.findAll({
        ...(serverId && { serverId }),
        sessionEnd: null,
      });
    } catch (error) {
      logger.error("Failed to get active sessions:", error);
      throw error;
    }
  }

  /**
   * End all active sessions for a server
   *
   * @param serverId - Optional server ID (all servers if omitted)
   * @returns Promise resolving to the number of sessions terminated
   */
  async endAllActiveSessions(serverId?: number): Promise<number> {
    try {
      const count = await Q.player.session.updateAll(
        { sessionEnd: new Date() },
        {
          ...(serverId && { serverId }),
          sessionEnd: null,
        },
      );

      logger.info(`Ended ${count} active session(s)`);
      return count;
    } catch (error) {
      logger.error("Failed to end all active sessions:", error);
      throw error;
    }
  }

  // ============================================================================
  // PLAYER STATISTICS
  // ============================================================================

  /**
   * Get comprehensive player statistics
   *
   * @param playerMinecraftUuid - Minecraft player UUID
   * @param serverId - Server ID
   *
   * @returns Object containing PlayerPlaytimeSummary, PlayerPlaytimeDaily, PlayerHourlyPattern
   */
  async getPlayerStats(
    playerMinecraftUuid: string,
    serverId: number,
  ): Promise<{
    summary: PlayerPlaytimeSummary | null;
    dailyLast30: PlayerPlaytimeDaily[];
    hourlyPattern: PlayerHourlyPattern[];
  }> {
    try {
      const [summary, dailyLast30, hourlyPattern] = await Promise.all([
        Q.player.playtime.summary.find({
          playerMinecraftUuid,
          serverId,
        }),
        Q.player.playtime.daily.findAll(
          {
            playerMinecraftUuid,
            serverId,
            playDate: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          },
          { orderBy: "playDate", orderDirection: "ASC" },
        ),
        Q.player.playtime.hourly.getPlayerHourlyPattern(
          playerMinecraftUuid,
          serverId,
        ),
      ]);

      return {
        summary,
        dailyLast30,
        hourlyPattern,
      };
    } catch (error) {
      logger.error("Failed to get player stats:", error);
      throw error;
    }
  }

  /**
   * Get player's daily stats for a date range
   * Uses operators for range queries!
   *
   * @param playerMinecraftUuid - Player's Minecraft UUID
   * @param serverId - Server ID
   * @param startDate - Start date
   * @param endDate - End date
   */
  async getPlayerDailyRange(
    playerMinecraftUuid: string,
    serverId: number,
    startDate: Date,
    endDate: Date,
  ): Promise<PlayerPlaytimeDaily[]> {
    try {
      return await Q.player.playtime.daily.findAll(
        {
          playerMinecraftUuid,
          serverId,
          playDate: { $between: [startDate, endDate] },
        },
        { orderBy: "playDate", orderDirection: "ASC" },
      );
    } catch (error) {
      logger.error("Failed to get player daily range:", error);
      throw error;
    }
  }

  /**
   * Get player's hourly data for a time range
   * Uses operators!
   *
   * @param playerMinecraftUuid - Player's Minecraft UUID
   * @param serverId - Server ID
   * @param startTime - Start timestamp
   * @param endTime - End timestamp
   */
  async getPlayerHourlyRange(
    playerMinecraftUuid: string,
    serverId: number,
    startTime: Date,
    endTime: Date,
  ): Promise<PlayerPlaytimeHourly[]> {
    try {
      return await Q.player.playtime.hourly.findAll(
        {
          playerMinecraftUuid,
          serverId,
          playHour: { $gte: startTime, $lt: endTime },
        },
        { orderBy: "playHour", orderDirection: "ASC" },
      );
    } catch (error) {
      logger.error("Failed to get player hourly range:", error);
      throw error;
    }
  }

  /**
   * Get player's recent session history
   *
   * @param playerMinecraftUuid - Player's Minecraft UUID
   * @param serverId - Server ID
   * @param limit - Number of sessions to return
   * @param includeActive - Whether to include active sessions
   */
  async getPlayerSessionHistory(
    playerMinecraftUuid: string,
    serverId: number,
    limit: number = 50,
    includeActive: boolean = false,
  ): Promise<PlayerSession[]> {
    try {
      return await Q.player.session.findAll(
        {
          playerMinecraftUuid,
          serverId,
          ...(includeActive ? {} : { sessionEnd: { $ne: null } }),
        },
        { limit, orderBy: "sessionStart", orderDirection: "DESC" },
      );
    } catch (error) {
      logger.error("Failed to get player session history:", error);
      throw error;
    }
  }

  /**
   * Get sessions longer than a certain duration
   * Uses operators!
   *
   * @param playerMinecraftUuid - Player's Minecraft UUID
   * @param serverId - Server ID
   * @param minSeconds - Minimum session length in seconds
   */
  async getLongSessions(
    playerMinecraftUuid: string,
    serverId: number,
    minSeconds: bigint,
  ): Promise<PlayerSession[]> {
    try {
      return await Q.player.session.findAll(
        {
          playerMinecraftUuid,
          serverId,
          secondsPlayed: { $gte: minSeconds },
        },
        { orderBy: "secondsPlayed", orderDirection: "DESC" },
      );
    } catch (error) {
      logger.error("Failed to get long sessions:", error);
      throw error;
    }
  }

  // ============================================================================
  // SERVER STATISTICS
  // ============================================================================

  /**
   * Get server-wide statistics
   *
   * @param serverId - Server ID
   */
  async getServerStats(serverId: number): Promise<{
    summary: ServerStats;
    leaderboard: LeaderboardEntry[];
  }> {
    try {
      const [summary, leaderboard] = await Promise.all([
        Q.player.playtime.summary.getServerStats(serverId),
        Q.player.playtime.summary.getLeaderboard(serverId, 10),
      ]);

      return {
        summary,
        leaderboard,
      };
    } catch (error) {
      logger.error("Failed to get server stats:", error);
      throw error;
    }
  }

  /**
   * Get server activity over time
   *
   * @param serverId - Server ID
   * @param days - Number of days to include
   */
  async getServerActivity(
    serverId: number,
    days: number = 30,
  ): Promise<ServerActivity[]> {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      return await Q.player.playtime.daily.getServerActivity(
        serverId,
        startDate,
        endDate,
      );
    } catch (error) {
      logger.error("Failed to get server activity:", error);
      throw error;
    }
  }

  /**
   * Get server activity heatmap
   *
   * @param serverId - Server ID
   * @param days - Number of days to include
   */
  async getServerHeatmap(
    serverId: number,
    days: number = 30,
  ): Promise<ServerHeatMap[]> {
    try {
      return await Q.player.playtime.hourly.getServerHeatmap(serverId, days);
    } catch (error) {
      logger.error("Failed to get server heatmap:", error);
      throw error;
    }
  }

  /**
   * Get top players by playtime for a specific date range
   * Uses operators!
   *
   * @param serverId - Server ID
   * @param startDate - Start date
   * @param endDate - End date
   * @param limit - Number of players to return
   */
  async getTopPlayersByDateRange(
    serverId: number,
    startDate: Date,
    endDate: Date,
    limit: number = 10,
  ) {
    try {
      const dailyRecords = await Q.player.playtime.daily.findAll({
        serverId,
        playDate: { $between: [startDate, endDate] },
      });

      const playerTotals = new Map<string, bigint>();

      for (const record of dailyRecords) {
        const current = playerTotals.get(record.playerMinecraftUuid) || 0n;
        playerTotals.set(
          record.playerMinecraftUuid,
          current + record.secondsPlayed,
        );
      }

      const sorted = Array.from(playerTotals.entries())
        .sort((a, b) => Number(b[1] - a[1]))
        .slice(0, limit);

      return await Promise.all(
        sorted.map(async ([uuid, seconds]) => {
          const player = await Q.player.get({ minecraftUuid: uuid });
          return {
            minecraftUsername: player.minecraftUsername,
            totalSeconds: Number(seconds),
            totalHours: Number(seconds) / 3600,
          };
        }),
      );
    } catch (error) {
      logger.error("Failed to get top players by date range:", error);
      throw error;
    }
  }

  // ============================================================================
  // INTEGRATION WITH PLAYTIME SERVICE
  // ============================================================================

  /**
   * Connect this repository to a PlaytimeService instance
   * Sets up event listeners for automatic session tracking
   *
   * @param service - PlaytimeService instance
   * @param serverId - Server ID this service belongs to
   */
  connectToService(service: PlaytimeService, serverId: number): void {
    service.on("sessionStart", async (event) => {
      try {
        const sessionId = await this.startSession(event);

        if (sessionId !== null) {
          service.setSessionId(event.uuid, sessionId);
        }
      } catch (error) {
        logger.error(
          `Failed to handle sessionStart event for server ${serverId}:`,
          error,
        );
      }
    });

    service.on("sessionEnd", async (event) => {
      try {
        await this.endSession(event);
      } catch (error) {
        logger.error(
          `Failed to handle sessionEnd event for server ${serverId}:`,
          error,
        );
      }
    });

    service.on("serverShutdown", async (serverId: number) => {
      try {
        const count = await this.endAllActiveSessions(serverId);
        logger.info(
          `Fallback: Closed ${count} orphaned database sessions for server ${serverId}`,
        );
      } catch (error) {
        logger.error(
          `Failed to clean up database sessions for server ${serverId}:`,
          error,
        );
      }
    });

    logger.info(
      `PlaytimeRepository connected to PlaytimeService for server ${serverId}`,
    );
  }
}
