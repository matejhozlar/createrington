import { Q, waitlistRepo } from "@/db";
import type { ServerActivity } from "@/db/queries/player/playtime/daily";
import type { ServerHeatMap } from "@/db/queries/player/playtime/hourly";
import type {
  LeaderboardEntry,
  ServerStats,
} from "@/db/queries/player/playtime/summary";
import type { PlayerSession } from "@/generated/db";
import { PlaytimeService } from "@/services/playtime";
import type {
  SessionEndEvent,
  SessionMetadata,
  SessionStartEvent,
} from "@/services/playtime";

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === "23505"
  );
}

/**
 * Coordinates session lifecycle and playtime aggregation. Owns the writes
 * that replace the old DB triggers: closing orphaned sessions, aggregating
 * completed sessions into daily / hourly / summary tables, and syncing
 * player online status plus last logout position. Wire up to a per-server
 * PlaytimeService via connectToService() during bootstrap; the service emits
 * the events this class persists.
 */
export class PlaytimeRepository {
  constructor() {}

  /**
   * Persist a session start. Closes any orphaned active sessions for the same
   * (player, server) pair first, retries once on the unique-index race, then
   * flips the player online and clears the first-Minecraft onboarding flag.
   * Returns null when the player is unregistered or the username mismatches.
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

      const closeOrphans = async (): Promise<void> => {
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
      };

      await closeOrphans();

      // The unique partial index on (uuid, server_id) WHERE session_end IS NULL
      // means a concurrent join from the same player can lose the close-then-
      // insert race here. Retry once after closing orphans again.
      let session;
      try {
        session = await Q.player.session.createAndReturn({
          playerMinecraftUuid: event.uuid,
          serverId: event.serverId,
          sessionStart: event.sessionStart,
        });
      } catch (err) {
        if (isUniqueViolation(err)) {
          await closeOrphans();
          session = await Q.player.session.createAndReturn({
            playerMinecraftUuid: event.uuid,
            serverId: event.serverId,
            sessionStart: event.sessionStart,
          });
        } else {
          throw err;
        }
      }

      // Sync player online status
      await Q.player.update(
        { minecraftUuid: event.uuid },
        {
          online: true,
          lastSeen: new Date(),
          currentServerId: event.serverId,
        },
      );

      // Mark "Joined Minecraft" onboarding step on first-ever session
      if (player.discordId) {
        try {
          const entry = await Q.waitlist.entry.find({
            discordId: player.discordId,
          });
          if (entry && !entry.joinedMinecraft) {
            await waitlistRepo.markJoinedMinecraft(player.discordId);
          }
        } catch {
          // No waitlist entry for this player; skip
        }
      }

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
   * Persist a session end: close the row, aggregate playtime into daily /
   * hourly / summary, then sync the player's online flag and logout
   * position. event.sessionId === 0 means "close every active session on
   * this server" (used after a backend restart leaves orphans).
   */
  async endSession(event: SessionEndEvent): Promise<void> {
    try {
      if (event.sessionId === 0) {
        // Orphaned session: find then close all active DB sessions
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

      // Sync player online status and persist logout position
      await this.syncPlayerOfflineStatus(
        event.uuid,
        event.sessionEnd,
        event.metadata,
      );
    } catch (error) {
      logger.error("Failed to end session:", error);
      throw error;
    }
  }

  /** All currently open sessions, optionally filtered to one server. */
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
   * Close every open session (optionally scoped to one server), aggregate
   * each into playtime tables, and mark affected players offline. Returns
   * the number of sessions closed.
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

  /** Aggregate server summary plus the top-10 playtime leaderboard. */
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

  /** Daily activity rows for the server over the trailing N days (default 30). */
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

  /** Heatmap buckets grouped by day-of-week and hour-of-day over the trailing N days. */
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
   * Top players by total seconds in [startDate, endDate]. Aggregates from
   * the dailies in memory and joins back to player names, so cost scales
   * with the row count over the range, not with the player table.
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

  private async syncPlayerOfflineStatus(
    playerMinecraftUuid: string,
    lastSeen: Date,
    metadata?: SessionMetadata,
  ): Promise<void> {
    // Defensive: upstream service-layer guards should already prevent nil
    // UUIDs from reaching here, but a leak would otherwise surface as a
    // NotFoundError when the update misses a non-existent player row.
    if (playerMinecraftUuid === "00000000-0000-0000-0000-000000000000") {
      return;
    }

    const remaining = await Q.player.session.findAll({
      playerMinecraftUuid,
      sessionEnd: null,
    });

    if (remaining.length === 0) {
      await Q.player.update(
        { minecraftUuid: playerMinecraftUuid },
        {
          online: false,
          lastSeen,
          currentServerId: null,
          ...(metadata?.position && {
            logoutX: Math.floor(metadata.position.x),
            logoutY: Math.floor(metadata.position.y),
            logoutZ: Math.floor(metadata.position.z),
          }),
          ...(metadata && { logoutDimension: metadata.dimension ?? null }),
        },
      );
    }
  }

  /**
   * Subscribe to a PlaytimeService instance so its sessionStart, sessionEnd,
   * and serverShutdown events drive this repository's writes. Call once per
   * server during bootstrap.
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
        service.emit("sessionAggregated", event);
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
