import { Q, waitlistRepo } from "@/db";
import { calendarDay } from "@/db/utils";
import type { ServerActivity } from "@/db/queries/player/playtime/daily";
import type { ServerHeatMap } from "@/db/queries/player/playtime/hourly";
import type {
  LeaderboardEntry,
  ServerStats,
} from "@/db/queries/player/playtime/summary";
import type { OpenSessionEntry } from "@/db/queries/player/session";
import type { Player, PlayerSession } from "@/generated/db";
import { PlaytimeService } from "@/services/playtime";
import type {
  PlaytimeCredit,
  SessionEndEvent,
  SessionMetadata,
  SessionProgressEvent,
  SessionStartEvent,
} from "@/services/playtime";
import { computeCredit, TICKS_PER_SECOND } from "@/services/playtime/credit";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

const RECONCILE_SUSPICIOUS_DROP_RATIO = 0.5;
const RECONCILE_SUSPICIOUS_MIN_TOTAL_SECONDS = 3600;

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === "23505"
  );
}

function clampSessionEnd(sessionStart: Date, candidate: Date): Date {
  return candidate < sessionStart ? sessionStart : candidate;
}

const ACTIVITY_WINDOW_DAYS = 365;

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function currentStreak(days: Record<string, number>): number {
  const check = new Date();
  if (!days[calendarDay(check)]) check.setDate(check.getDate() - 1);
  let streak = 0;
  while (days[calendarDay(check)]) {
    streak++;
    check.setDate(check.getDate() - 1);
  }
  return streak;
}

function mostActiveWeekday(days: Record<string, number>): string | null {
  const totals = [0, 0, 0, 0, 0, 0, 0];
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const [date, seconds] of Object.entries(days)) {
    const weekday = new Date(date).getUTCDay();
    totals[weekday] += seconds;
    counts[weekday]++;
  }
  let best: number | null = null;
  let bestAverage = 0;
  for (let weekday = 0; weekday < 7; weekday++) {
    const average = counts[weekday] > 0 ? totals[weekday] / counts[weekday] : 0;
    if (average > bestAverage) {
      bestAverage = average;
      best = weekday;
    }
  }
  return best === null ? null : WEEKDAY_NAMES[best];
}

export interface PlayerActivity {
  online: boolean;
  currentSessionSeconds: number | null;
  totalSeconds: number;
  currentStreak: number;
  mostActiveDay: string | null;
  days: Record<string, number>;
}

export interface StatsReconcileEntry {
  minecraftUuid: string;
  playTimeTicks: number;
}

export interface StatsReconcileResult {
  checked: number;
  applied: number;
  drifted: number;
  skippedOpen: number;
  skippedSuspicious: number;
}

/**
 * Coordinates session lifecycle and playtime aggregation. Owns the writes
 * that replace the old DB triggers: persisting session rows, crediting
 * observed playtime into daily / hourly / summary tables, and syncing
 * player online status plus last logout position. Playtime is credited
 * incrementally as heartbeats observe it, so an in-flight session is never
 * more than one heartbeat behind in the database. Wire up to a per-server
 * PlaytimeService via connectToService() during bootstrap; the service emits
 * the events this class persists.
 */
export class PlaytimeRepository {
  private pending = new Set<Promise<unknown>>();

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

      const row = {
        playerMinecraftUuid: event.uuid,
        serverId: event.serverId,
        sessionStart: event.sessionStart,
        lastSeenAt: event.sessionStart,
        startPlayTicks: event.playTimeTicks ?? null,
        lastPlayTicks: event.playTimeTicks ?? null,
      };

      // The unique partial index on (uuid, server_id) WHERE session_end IS NULL
      // means a concurrent join from the same player can lose the close-then-
      // insert race here. Retry once after closing orphans again.
      let session;
      try {
        session = await Q.player.session.createAndReturn(row);
      } catch (error) {
        if (isUniqueViolation(error)) {
          await closeOrphans();
          session = await Q.player.session.createAndReturn(row);
        } else {
          throw error;
        }
      }

      await Q.player.update(
        { minecraftUuid: event.uuid },
        {
          online: true,
          lastSeen: new Date(),
          currentServerId: event.serverId,
        },
      );

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

  /** Persist a heartbeat observation: advance the row and credit the slice into the playtime tables. */
  async progressSession(event: SessionProgressEvent): Promise<void> {
    try {
      await Q.player.session.recordObservation(event.sessionId, {
        lastSeenAt: event.credit.periodEnd,
        lastPlayTicks: event.credit.playTimeTicks,
        creditedSeconds: event.credit.seconds,
      });

      await this.creditPlaytime(event.uuid, event.serverId, event.credit);

      if (event.credit.seconds > 0) {
        logger.debug(
          `Session ${event.sessionId} progressed: ${event.username} +${event.credit.seconds}s`,
        );
      }
    } catch (error) {
      logger.error("Failed to progress session:", error);
      throw error;
    }
  }

  /**
   * Persist a session end: close the row, credit the final slice, count the
   * session, then sync the player's online flag and logout position.
   * event.sessionId === 0 means "close every open session for this player on
   * this server", crediting each from its own last observation.
   */
  async endSession(event: SessionEndEvent): Promise<void> {
    try {
      if (event.sessionId === 0) {
        const openSessions = await Q.player.session.findAll({
          playerMinecraftUuid: event.uuid,
          serverId: event.serverId,
          sessionEnd: null,
        });

        for (const session of openSessions) {
          await this.closeRow(session, event.sessionEnd, event.playTimeTicks);
        }

        if (openSessions.length > 0) {
          logger.info(
            `Closed ${openSessions.length} orphaned session(s) for ${event.username} (${event.uuid}) on server ${event.serverId}`,
          );
        }
      } else {
        const end = clampSessionEnd(event.sessionStart, event.sessionEnd);
        const credit: PlaytimeCredit = event.credit ?? {
          periodStart: end,
          periodEnd: end,
          seconds: 0,
          playTimeTicks: event.playTimeTicks,
        };

        await Q.player.session.recordObservation(event.sessionId, {
          lastSeenAt: end,
          lastPlayTicks: credit.playTimeTicks,
          creditedSeconds: credit.seconds,
          sessionEnd: end,
        });

        await this.creditPlaytime(event.uuid, event.serverId, credit);
        await Q.player.playtime.summary.recordSessionEnd(
          event.uuid,
          event.serverId,
          event.sessionStart,
          end,
        );

        logger.info(
          `Session ended: ${event.username} (${event.uuid}) - ${event.secondsPlayed}s`,
        );
      }

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

  /** Open sessions on a server with usernames, for restoring the in-memory tracker after a restart. */
  async getOpenSessions(serverId: number): Promise<OpenSessionEntry[]> {
    try {
      return await Q.player.session.findOpenWithUsername(serverId);
    } catch (error) {
      logger.error("Failed to get open sessions:", error);
      throw error;
    }
  }

  /**
   * Compare stored summary totals against the vanilla play_time stat
   * imported from the game server and overwrite drifted totals with the stat
   * when `apply` is set. Only player_playtime_summary is corrected: the
   * daily/hourly buckets keep their observed values and will not sum to a
   * corrected total. Players with an open session are skipped (their stats
   * file is stale while online), as are drops below half the stored total,
   * which indicate a reset stats file rather than a correction. Always logs
   * the drift it finds so the report is useful in dry-run mode.
   */
  async reconcileTotalsFromStats(
    serverId: number,
    entries: StatsReconcileEntry[],
    options: { apply: boolean },
  ): Promise<StatsReconcileResult> {
    const result: StatsReconcileResult = {
      checked: 0,
      applied: 0,
      drifted: 0,
      skippedOpen: 0,
      skippedSuspicious: 0,
    };
    if (entries.length === 0) return result;

    const openSessions = await Q.player.session.findAll({
      serverId,
      sessionEnd: null,
    });
    const openUuids = new Set(openSessions.map((s) => s.playerMinecraftUuid));
    const totals = await Q.player.playtime.summary.getTotals(
      serverId,
      entries.map((e) => e.minecraftUuid),
    );

    for (const entry of entries) {
      const stored = totals.get(entry.minecraftUuid);
      if (stored === undefined) continue;
      result.checked++;

      if (openUuids.has(entry.minecraftUuid)) {
        result.skippedOpen++;
        continue;
      }

      const expected = Math.floor(entry.playTimeTicks / TICKS_PER_SECOND);
      const drift = expected - stored;
      if (drift === 0) continue;
      result.drifted++;

      const suspicious =
        stored >= RECONCILE_SUSPICIOUS_MIN_TOTAL_SECONDS &&
        expected < stored * RECONCILE_SUSPICIOUS_DROP_RATIO;

      if (suspicious) {
        result.skippedSuspicious++;
        logger.warn(
          `Playtime reconcile: ${entry.minecraftUuid} on server ${serverId} stat says ${expected}s but ${stored}s is stored; drop looks like a reset stats file, skipping`,
        );
        continue;
      }

      logger.info(
        `Playtime reconcile: ${entry.minecraftUuid} on server ${serverId} drift ${drift > 0 ? "+" : ""}${drift}s (stored ${stored}s, stat ${expected}s)${options.apply ? ", applying to summary total (daily/hourly untouched)" : ""}`,
      );

      if (options.apply) {
        const updated = await Q.player.playtime.summary.setTotalSeconds(
          entry.minecraftUuid,
          serverId,
          expected,
        );
        if (updated) result.applied++;
      }
    }

    return result;
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
        calendarDay(startDate),
        calendarDay(endDate),
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
        playDate: { $between: [calendarDay(startDate), calendarDay(endDate)] },
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

  /**
   * A player's daily playtime over the trailing year (summed across servers)
   * plus the headline figures shown next to the heatmap.
   */
  async getPlayerActivity(
    player: Pick<Player, "minecraftUuid" | "online">,
  ): Promise<PlayerActivity> {
    const { minecraftUuid } = player;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - ACTIVITY_WINDOW_DAYS);

    const [rows, summaries, activeSession] = await Promise.all([
      Q.player.playtime.daily
        .where({
          playerMinecraftUuid: minecraftUuid,
          playDate: { $gte: calendarDay(startDate) },
        })
        .all(),
      Q.player.playtime.summary.findAll({ playerMinecraftUuid: minecraftUuid }),
      player.online
        ? Q.player.session
            .where({
              playerMinecraftUuid: minecraftUuid,
              sessionEnd: { $exists: false },
            })
            .orderBy("sessionStart", "desc")
            .first()
        : null,
    ]);

    const days: Record<string, number> = {};
    for (const row of rows) {
      days[row.playDate] =
        (days[row.playDate] ?? 0) + Number(row.secondsPlayed);
    }

    return {
      online: player.online,
      currentSessionSeconds: activeSession
        ? Math.floor((Date.now() - activeSession.sessionStart.getTime()) / 1000)
        : null,
      totalSeconds: summaries.reduce(
        (sum, summary) => sum + Number(summary.totalSeconds),
        0,
      ),
      currentStreak: currentStreak(days),
      mostActiveDay: mostActiveWeekday(days),
      days,
    };
  }

  /** Waits for in-flight event writes to settle, up to `timeoutMs`. Call before process exit. */
  async flush(timeoutMs: number): Promise<void> {
    if (this.pending.size === 0) return;

    logger.info(
      `Waiting for ${this.pending.size} in-flight playtime write(s)...`,
    );

    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        Promise.allSettled(Array.from(this.pending)),
        new Promise((resolve) => {
          timer = setTimeout(resolve, timeoutMs);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }

    if (this.pending.size > 0) {
      logger.warn(
        `${this.pending.size} playtime write(s) still in flight after ${timeoutMs}ms`,
      );
    }
  }

  private async closeRow(
    session: PlayerSession,
    sessionEnd: Date,
    playTimeTicks: number | undefined,
  ): Promise<void> {
    const end = clampSessionEnd(session.sessionStart, sessionEnd);
    const credit = computeCredit({
      periodStart: session.lastSeenAt ?? session.sessionStart,
      periodEnd: end,
      lastPlayTicks: session.lastPlayTicks,
      playTimeTicks,
    });

    await Q.player.session.recordObservation(session.id, {
      lastSeenAt: end,
      lastPlayTicks: credit.playTimeTicks,
      creditedSeconds: credit.seconds,
      sessionEnd: end,
    });

    await this.creditPlaytime(
      session.playerMinecraftUuid,
      session.serverId,
      credit,
    );
    await Q.player.playtime.summary.recordSessionEnd(
      session.playerMinecraftUuid,
      session.serverId,
      session.sessionStart,
      end,
    );
  }

  private async creditPlaytime(
    playerMinecraftUuid: string,
    serverId: number,
    credit: PlaytimeCredit,
  ): Promise<void> {
    if (credit.seconds <= 0) return;

    await Promise.all([
      Q.player.playtime.daily.creditPeriod(
        playerMinecraftUuid,
        serverId,
        credit.periodStart,
        credit.periodEnd,
        credit.seconds,
      ),
      Q.player.playtime.hourly.creditPeriod(
        playerMinecraftUuid,
        serverId,
        credit.periodStart,
        credit.periodEnd,
        credit.seconds,
      ),
      Q.player.playtime.summary.creditSeconds(
        playerMinecraftUuid,
        serverId,
        credit.seconds,
        credit.periodStart,
        credit.periodEnd,
      ),
    ]);
  }

  private async syncPlayerOfflineStatus(
    playerMinecraftUuid: string,
    lastSeen: Date,
    metadata?: SessionMetadata,
  ): Promise<void> {
    if (playerMinecraftUuid === NIL_UUID) {
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

  private track<T>(promise: Promise<T>): Promise<T> {
    this.pending.add(promise);
    return promise.finally(() => this.pending.delete(promise));
  }

  /**
   * Subscribe to a PlaytimeService instance so its sessionStart,
   * sessionProgress, and sessionEnd events drive this repository's writes.
   * Call once per server during bootstrap.
   */
  connectToService(service: PlaytimeService, serverId: number): void {
    service.on("sessionStart", (event) => {
      void this.track(
        this.startSession(event)
          .then((sessionId) => {
            if (sessionId !== null) {
              service.setSessionId(event.uuid, sessionId);
            }
          })
          .catch((error) => {
            logger.error(
              `Failed to handle sessionStart event for server ${serverId}:`,
              error,
            );
          }),
      );
    });

    service.on("sessionProgress", (event) => {
      void this.track(
        this.progressSession(event).catch((error) => {
          logger.error(
            `Failed to handle sessionProgress event for server ${serverId}:`,
            error,
          );
        }),
      );
    });

    service.on("sessionEnd", (event) => {
      void this.track(
        this.endSession(event)
          .then(() => {
            service.emit("sessionAggregated", event);
          })
          .catch((error) => {
            logger.error(
              `Failed to handle sessionEnd event for server ${serverId}:`,
              error,
            );
          }),
      );
    });

    logger.info(
      `PlaytimeRepository connected to PlaytimeService for server ${serverId}`,
    );
  }
}
