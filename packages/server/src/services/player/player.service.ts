import {
  PlayerAuditRepository,
  PlayerBalanceRepository,
  PlayerBanRepository,
  PlayerRepository,
  PlayerSessionRepository,
  PlayerStrikeRepository,
  PlayerTicketRepository,
} from "@/db/repositories";
import type { PlayerIdentifier } from "@/db/repositories/player/base";

/**
 * Unified Player Service
 *
 * Provides a single interface to all player-related operations by
 * composing multiple focused repositories.
 *
 * Usage:
 * ```ts
 * const playerService = new PlayerService();
 *
 * // Core operations
 * const player = await playerService.core.getDetailed(uuid);
 * await playerService.core.adminUpdate(uuid, updates, adminId, adminName, reason);
 *
 * // Strike operations
 * await playerService.strikes.issue(uuid, strikeData, adminId, adminName);
 * const activeStrikes = await playerService.strikes.countActive(uuid);
 *
 * // Session operations
 * const sessions = await playerService.sessions.getHistory(uuid, serverId);
 *
 * // Ticket operations
 * const tickets = await playerService.tickets.getAll(uuid);
 *
 * // Audit operations
 * const auditLog = await playerService.audit.getLog(uuid);
 *
 * // Balance operations
 * await playerService.balance.bulkAdjust(uuids, amount, adminId, adminName, reason);
 *
 * // Ban operations
 * await playerService.bans.issueTemporary(uuid, { reason, expiresAt }, adminId, adminName);
 * await playerService.bans.issuePermanent(uuid, { reason }, adminId, adminName);
 * const isBanned = await playerService.bans.isBanned(uuid);
 * ```
 */
export class PlayerService {
  /** Core player CRUD and detailed information */
  public readonly core: PlayerRepository;

  /** Player strike management */
  public readonly strikes: PlayerStrikeRepository;

  /** Player session history */
  public readonly sessions: PlayerSessionRepository;

  /** Player ticket management */
  public readonly tickets: PlayerTicketRepository;

  /** Player audit log management */
  public readonly audit: PlayerAuditRepository;

  /** Player balance operations (bulk operations) */
  public readonly balance: PlayerBalanceRepository;

  /** Player ban management (temporary and permanent) */
  public readonly bans: PlayerBanRepository;

  constructor() {
    this.core = new PlayerRepository();
    this.strikes = new PlayerStrikeRepository();
    this.sessions = new PlayerSessionRepository();
    this.tickets = new PlayerTicketRepository();
    this.audit = new PlayerAuditRepository();
    this.balance = new PlayerBalanceRepository();
    this.bans = new PlayerBanRepository();
  }

  // ============================================================================
  // CONVENIENCE METHODS - AGGREGATED VIEWS
  // ============================================================================

  /**
   * Gets comprehensive player data for admin panel
   * Aggregates data from multiple repositories
   *
   * @param identifier - Player identifier
   * @returns Promise resolving to comprehensive player data
   */
  async getComprehensive(identifier: PlayerIdentifier) {
    const detailedInfo = await this.core.getDetailed(identifier);
    const strikes = await this.strikes.getHistory(identifier, false); // false = include all strikes
    const banHistory = await this.bans.getHistory(identifier, true);
    const currentBan = await this.bans.getCurrent(identifier);

    const activeStrikes = strikes.filter((s) => !s.removed);
    const activeBans = banHistory.filter((b) => !b.unbanned);

    return {
      ...detailedInfo,
      strikes: {
        all: strikes,
        active: activeStrikes,
        activeCount: activeStrikes.length,
        totalCount: strikes.length,
      },
      bans: {
        current: currentBan,
        history: banHistory,
        active: activeBans,
        activeCount: activeBans.length,
        totalCount: banHistory.length,
      },
    };
  }

  /**
   * Gets player overview with key statistics
   * Optimized for list views
   *
   * @param identifier - Player identifier
   * @returns Promise resolving to player overview
   */
  async getOverview(identifier: PlayerIdentifier) {
    const [player, activeStrikes, sessionCount, openTickets, isBanned] =
      await Promise.all([
        this.core.getDetailed(identifier),
        this.strikes.countActive(identifier),
        this.sessions.count(identifier),
        this.tickets.count(identifier),
        this.bans.isBanned(identifier),
      ]);

    return {
      ...player.player,
      balance: player.balance,
      stats: {
        activeStrikes,
        totalSessions: sessionCount,
        openTickets,
        totalPlaytimeSeconds: player.playtime.totalSeconds,
        isBanned,
      },
    };
  }
}

export const playerService = new PlayerService();
