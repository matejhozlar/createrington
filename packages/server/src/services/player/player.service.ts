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
 * Composes the player-domain repositories (core, strikes, sessions, tickets,
 * audit, balance, bans) into a single accessor surface. Stateless: a singleton
 * is exported at the bottom of the file and reused everywhere.
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

  /** Aggregates detailed player data, strike history, and ban history for the admin panel. */
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

  /** Returns a compact player snapshot (balance plus key counts) suitable for list rows. */
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
