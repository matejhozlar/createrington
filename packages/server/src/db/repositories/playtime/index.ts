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
 * - Player state synchronization (online status, last seen)
 * - Playtime aggregation (daily/hourly/summary)
 * - Playtime statistics retrieval
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
   * Closes any existing active sessions for this player on this server
   * before creating a new one to prevent duplicates.
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

      // Close any orphaned active sessions for this player on this server
      const closedCount = await Q.player.session.updateAll(
        { sessionEnd: event.sessionStart },
        {
          playerMinecraftUuid: event.uuid,
          serverId: event.serverId,
          sessionEnd: null,
        },
      );

      if (closedCount > 0) {
        logger.warn(
          `Closed ${closedCount} orphaned active session(s) for ${event.username} (${event.uuid}) on server ${event.serverId}`,
        );
      }

      const session = await Q.player.session.createAndReturn({
        playerMinecraftUuid: event.uuid,
        serverId: event.serverId,
        sessionStart: event.sessionStart,
      });

      // Sync player online status
      await Q.player.update(
        { minecraftUuid: event.uuid },
        {
          online: true,
          lastSeen: new Date(),
          currentServerId: event.serverId,
        },
      );

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
   * Called when PlaytimeService emits 'sessionEnd' event
   *
   * Handles: closing the session, aggregating playtime stats,
   * and syncing the player's online status.
   *
   * When sessionId is 0, closes all active DB sessions for the player
   * on the given server (handles orphaned sessions after backend restart).
   *
   * @param event - Session end event data
   */
  async endSession(event: SessionEndEvent): Promise<void> {
    try {
      if (event.sessionId === 0) {
        // Orphaned session — find then close all active DB sessions
        const activeSessions = await Q.player.session.findAll({
          playerMinecraftUuid: event.uuid,
          serverId: event.serverId,
          sessionEnd: null,
        });

        if (activeSessions.length > 0) {
          await Q.player.session.updateAll(
            { sessionEnd: event.sessionEnd },
            {
              playerMinecraftUuid: event.uuid,
              serverId: event.serverId,
              sessionEnd: null,
            },
          );

          // Aggregate each orphaned session
          for (const session of activeSessions) {
            await this.aggregateSessionPlaytime(
              event.uuid,
              event.serverId,
              session.sessionStart,
              event.sessionEnd,
            );
          }

          logger.info(
            `Closed ${activeSessions.length} orphaned session(s) for ${event.username} (${event.uuid}) on server ${event.serverId}`,
          );
        }
      } else {
        await Q.player.session.update(
          { id: event.sessionId },
          { sessionEnd: event.sessionEnd },
        );

        // Aggregate playtime stats
        await this.aggregateSessionPlaytime(
          event.uuid,
          event.serverId,
          event.sessionStart,
          event.sessionEnd,
        );

        logger.info(
          `Session ended: ${event.username} (${event.uuid}) - ${event.secondsPlayed}s`,
        );
      }

      // Sync player online status
      await this.syncPlayerOfflineStatus(event.uuid, event.sessionEnd);
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
      const now = new Date();

      // Fetch active sessions before closing so we can aggregate them
      const activeSessions = await Q.player.session.findAll({
        ...(serverId && { serverId }),
        sessionEnd: null,
      });

      if (activeSessions.length === 0) return 0;

      await Q.player.session.updateAll(
        { sessionEnd: now },
        {
          ...(serverId && { serverId }),
          sessionEnd: null,
        },
      );

      // Aggregate each session and collect affected player UUIDs
      const affectedUuids = new Set<string>();
      for (const session of activeSessions) {
        affectedUuids.add(session.playerMinecraftUuid);
        await this.aggregateSessionPlaytime(
          session.playerMinecraftUuid,
          session.serverId,
          session.sessionStart,
          now,
        );
      }

      // Sync online status for all affected players
      for (const uuid of affectedUuids) {
        await this.syncPlayerOfflineStatus(uuid, now);
      }

      logger.info(`Ended ${activeSessions.length} active session(s)`);
      return activeSessions.length;
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
          { orderBy: "playDate", orderDirection: "asc" },
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
        { orderBy: "playDate", orderDirection: "asc" },
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
        { orderBy: "playHour", orderDirection: "asc" },
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
        { limit, orderBy: "sessionStart", orderDirection: "desc" },
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
        { orderBy: "secondsPlayed", orderDirection: "desc" },
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
  // INTERNAL HELPERS
  // ============================================================================

  /**
   * Aggregates a completed session into daily, hourly, and summary tables
   *
   * Runs all three aggregation queries in parallel.
   * Replaces the old update_playtime_aggregates database trigger.
   *
   * @param playerMinecraftUuid - Player's Minecraft UUID
   * @param serverId - Server ID the session occurred on
   * @param sessionStart - Session start timestamp
   * @param sessionEnd - Session end timestamp
   * @private
   */
  private async aggregateSessionPlaytime(
    playerMinecraftUuid: string,
    serverId: number,
    sessionStart: Date,
    sessionEnd: Date,
  ): Promise<void> {
    const secondsPlayed = Math.floor(
      (sessionEnd.getTime() - sessionStart.getTime()) / 1000,
    );
    if (secondsPlayed <= 0) return;

    await Promise.all([
      Q.player.playtime.daily.aggregateSession(
        playerMinecraftUuid,
        serverId,
        sessionStart,
        sessionEnd,
      ),
      Q.player.playtime.hourly.aggregateSession(
        playerMinecraftUuid,
        serverId,
        sessionStart,
        sessionEnd,
      ),
      Q.player.playtime.summary.aggregateSession(
        playerMinecraftUuid,
        serverId,
        secondsPlayed,
        sessionStart,
        sessionEnd,
      ),
    ]);
  }

  /**
   * Checks if a player still has active sessions; if not, marks them offline
   *
   * Replaces the old sync_player_online_status database trigger.
   *
   * @param playerMinecraftUuid - Player's Minecraft UUID
   * @param lastSeen - Timestamp to set as last_seen if going offline
   * @private
   */
  private async syncPlayerOfflineStatus(
    playerMinecraftUuid: string,
    lastSeen: Date,
  ): Promise<void> {
    const remaining = await Q.player.session.findAll({
      playerMinecraftUuid,
      sessionEnd: null,
    });

    if (remaining.length === 0) {
      await Q.player.update(
        { minecraftUuid: playerMinecraftUuid },
        { online: false, lastSeen, currentServerId: null },
      );
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
