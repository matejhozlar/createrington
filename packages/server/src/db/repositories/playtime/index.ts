import { db, Q } from "@/db/pool";
import { NIL_UUID } from "@/utils/player-identifier";
import { calendarDay } from "@/db/utils";
import { UniqueViolationError } from "@/db/utils/errors";
import { SYSTEM_AUDIT_ACTOR } from "@/db/queries/admin/log/action";
import { DatabaseTable, type DatabaseQueries } from "@/generated/db";
import type { ServerActivity } from "@/db/queries/player/playtime/daily";
import type {
  LeaderboardEntry,
  ServerStats,
} from "@/db/queries/player/playtime/summary";
import type { PlayerSession } from "@/generated/db";
import type {
  PlaytimeCredit,
  SessionEndEvent,
  SessionMetadata,
  SessionProgressEvent,
  SessionStartEvent,
} from "@/services/playtime";
import { computeCredit, TICKS_PER_SECOND } from "@/services/playtime/credit";

const RECONCILE_SUSPICIOUS_DROP_RATIO = 0.5;
const RECONCILE_SUSPICIOUS_MIN_TOTAL_SECONDS = 3600;

function clampSessionEnd(sessionStart: Date, candidate: Date): Date {
  return candidate < sessionStart ? sessionStart : candidate;
}

export interface StartedSession {
  sessionId: number;
  discordId: string;
  renamedFrom: string | null;
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
 * more than one heartbeat behind in the database. Each observation commits
 * together with its credits in one per-session transaction, so a failed
 * slice leaves nothing behind. PlaytimePersistence feeds it the events of
 * each per-server PlaytimeService.
 */
export class PlaytimeRepository {
  /**
   * Persist a session start. Closes any orphaned active sessions for the same
   * (player, server) pair first, retries once on the unique-index race, then
   * flips the player online. The UUID is authoritative: a player who joins
   * under a new Minecraft name has the stored name updated (audited, votes
   * under the new name linked) before the session opens. Returns the new row
   * id with the player's Discord id and the name they had before a rename,
   * or null when the player is unregistered.
   */
  async startSession(event: SessionStartEvent): Promise<StartedSession | null> {
    const player = await Q.player.find({
      minecraftUuid: event.uuid,
    });

    if (!player) {
      logger.debug(
        `Ignoring session start for unregistered player: ${event.username} (${event.uuid})`,
      );
      return null;
    }

    const renamedFrom =
      player.minecraftUsername !== event.username &&
      (await this.adoptUsername(
        event.uuid,
        player.minecraftUsername,
        event.username,
      ))
        ? player.minecraftUsername
        : null;

    const closeOrphans = async (): Promise<void> => {
      const closedCount = await Q.player.session.closeOpen(
        event.uuid,
        event.serverId,
        event.sessionStart,
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

    let session;
    try {
      session = await Q.player.session.createAndReturn(row);
    } catch (error) {
      if (error instanceof UniqueViolationError) {
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

    logger.info(
      `Session started: ${event.username} (${event.uuid}) - ID: ${session.id}`,
    );

    return { sessionId: session.id, discordId: player.discordId, renamedFrom };
  }

  private async adoptUsername(
    minecraftUuid: string,
    from: string,
    to: string,
  ): Promise<boolean> {
    try {
      await db.inTransaction(async (tx) => {
        await tx.player.update({ minecraftUuid }, { minecraftUsername: to });
        await tx.player.vote.linkUsername(to, minecraftUuid);
        await tx.admin.log.action.create({
          adminDiscordId: SYSTEM_AUDIT_ACTOR.discordId,
          adminUsername: SYSTEM_AUDIT_ACTOR.username,
          actionType: "update_player",
          targetPlayerUuid: minecraftUuid,
          targetPlayerName: from,
          tableName: DatabaseTable.PLAYER.TABLE,
          fieldName: "minecraftUsername",
          oldValue: from,
          newValue: to,
          reason: "Joined under a new Minecraft name",
        });
      });
    } catch (error) {
      if (!(error instanceof UniqueViolationError)) throw error;
      logger.warn(
        `${from} (${minecraftUuid}) joined as ${to}, but another player is still stored under ${to}; keeping the old name`,
      );
      return false;
    }

    logger.info(`Player ${from} (${minecraftUuid}) renamed to ${to}`);
    return true;
  }

  /** Persist a heartbeat observation: advance the row and credit the slice into the playtime tables, atomically. */
  async progressSession(event: SessionProgressEvent): Promise<void> {
    await db.inTransaction(async (tx) => {
      await tx.player.session.recordObservation(event.sessionId, {
        lastSeenAt: event.credit.periodEnd,
        lastPlayTicks: event.credit.playTimeTicks,
        creditedSeconds: event.credit.seconds,
      });

      await this.creditPlaytime(tx, event.uuid, event.serverId, event.credit);
    });

    if (event.credit.seconds > 0) {
      logger.debug(
        `Session ${event.sessionId} progressed: ${event.username} +${event.credit.seconds}s`,
      );
    }
  }

  /**
   * Persist a session end: close the row, credit the final slice, count the
   * session, then sync the player's online flag and logout position.
   * event.sessionId === 0 means "close every open session for this player on
   * this server", crediting each from its own last observation.
   */
  async endSession(event: SessionEndEvent): Promise<void> {
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

      await db.inTransaction(async (tx) => {
        await tx.player.session.recordObservation(event.sessionId, {
          lastSeenAt: end,
          lastPlayTicks: credit.playTimeTicks,
          creditedSeconds: credit.seconds,
          sessionEnd: end,
        });

        await this.creditPlaytime(tx, event.uuid, event.serverId, credit);
        await tx.player.playtime.summary.recordSessionEnd(
          event.uuid,
          event.serverId,
          event.sessionStart,
          end,
        );
      });

      logger.info(
        `Session ended: ${event.username} (${event.uuid}) - ${event.secondsPlayed}s`,
      );
    }

    await this.syncPlayerOfflineStatus(
      event.uuid,
      event.sessionEnd,
      event.metadata,
    );
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

    const [openSessions, totals] = await Promise.all([
      Q.player.session.findAll(
        { serverId, sessionEnd: null },
        { select: ["playerMinecraftUuid"] },
      ),
      Q.player.playtime.summary.getTotals(
        serverId,
        entries.map((e) => e.minecraftUuid),
      ),
    ]);
    const openUuids = new Set(openSessions.map((s) => s.playerMinecraftUuid));
    const corrections: Array<{
      playerMinecraftUuid: string;
      totalSeconds: number;
    }> = [];

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

      corrections.push({
        playerMinecraftUuid: entry.minecraftUuid,
        totalSeconds: expected,
      });
    }

    if (options.apply) {
      result.applied = await Q.player.playtime.summary.setTotalSecondsMany(
        serverId,
        corrections,
      );
    }

    return result;
  }

  /** Aggregate server summary plus the top-10 playtime leaderboard. */
  async getServerStats(serverId: number): Promise<{
    summary: ServerStats;
    leaderboard: LeaderboardEntry[];
  }> {
    const [summary, leaderboard] = await Promise.all([
      Q.player.playtime.summary.getServerStats(serverId),
      Q.player.playtime.summary.getLeaderboard(serverId, 10),
    ]);

    return {
      summary,
      leaderboard,
    };
  }

  /** Daily activity rows for the server over the trailing N days (default 30). */
  async getServerActivity(
    serverId: number,
    days: number = 30,
  ): Promise<ServerActivity[]> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const endDate = new Date();

    return await Q.player.playtime.daily.getServerActivity(
      serverId,
      calendarDay(startDate),
      calendarDay(endDate),
    );
  }

  /** Top players by total seconds in [startDate, endDate], summed and ranked in SQL. */
  async getTopPlayersByDateRange(
    serverId: number,
    startDate: Date,
    endDate: Date,
    limit: number = 10,
  ) {
    const rows = await Q.player.playtime.daily.getTopPlayers(
      serverId,
      calendarDay(startDate),
      calendarDay(endDate),
      limit,
    );

    return rows.map((row) => ({
      ...row,
      totalHours: row.totalSeconds / 3600,
    }));
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

    await db.inTransaction(async (tx) => {
      await tx.player.session.recordObservation(session.id, {
        lastSeenAt: end,
        lastPlayTicks: credit.playTimeTicks,
        creditedSeconds: credit.seconds,
        sessionEnd: end,
      });

      await this.creditPlaytime(
        tx,
        session.playerMinecraftUuid,
        session.serverId,
        credit,
      );
      await tx.player.playtime.summary.recordSessionEnd(
        session.playerMinecraftUuid,
        session.serverId,
        session.sessionStart,
        end,
      );
    });
  }

  private async creditPlaytime(
    tx: DatabaseQueries,
    playerMinecraftUuid: string,
    serverId: number,
    credit: PlaytimeCredit,
  ): Promise<void> {
    if (credit.seconds <= 0) return;

    await tx.player.playtime.daily.creditPeriod(
      playerMinecraftUuid,
      serverId,
      credit.periodStart,
      credit.periodEnd,
      credit.seconds,
    );
    await tx.player.playtime.hourly.creditPeriod(
      playerMinecraftUuid,
      serverId,
      credit.periodStart,
      credit.periodEnd,
      credit.seconds,
    );
    await tx.player.playtime.summary.creditSeconds(
      playerMinecraftUuid,
      serverId,
      credit.seconds,
      credit.periodStart,
      credit.periodEnd,
    );
  }

  private async syncPlayerOfflineStatus(
    playerMinecraftUuid: string,
    lastSeen: Date,
    metadata?: SessionMetadata,
  ): Promise<void> {
    if (playerMinecraftUuid === NIL_UUID) {
      return;
    }

    const remaining = await Q.player.session.count({
      playerMinecraftUuid,
      sessionEnd: null,
    });

    if (remaining === 0) {
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
}
