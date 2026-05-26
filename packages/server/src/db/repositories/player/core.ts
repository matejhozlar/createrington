import { db, Q } from "@/db";
import { DatabaseTable } from "@/generated/db";
import type {
  Player,
  PlayerBalance,
  PlayerBalanceTransaction,
  PlayerFilters,
  PlayerPlaytimeSummary,
  WaitlistEntry,
} from "@createrington/shared/db";
import { TicketStatus } from "@/services/discord/tickets";
import { BalanceUtils } from "../balance/utils";
import { AdminEdit } from "@/types";
import { BasePlayerRepository, type PlayerIdentifier } from "./base";

/**
 * Core player CRUD plus the aggregate read paths used by the admin panel
 * (detailed lookup, list/count, balance summary, server-wide stats). Mutations
 * that need an admin audit trail (adminUpdate, adminDelete) write to
 * admin_log_action inside the same transaction.
 */
export class PlayerRepository extends BasePlayerRepository {
  constructor() {
    super();
  }

  /** Enriched player view for the admin panel: balance, playtime, tickets, waitlist. */
  async getDetailed(identifier: PlayerIdentifier): Promise<{
    player: Player;
    balance: PlayerBalance | null;
    playtime: {
      summary: PlayerPlaytimeSummary[];
      totalSeconds: number;
      totalSessions: number;
    };
    tickets: {
      total: number;
      open: number;
    };
    waitlist: WaitlistEntry | null;
  }> {
    const uuid = await this.resolvePlayerUuid(identifier);
    const player = await Q.player.get({ minecraftUuid: uuid });

    const [balance, playtimeSummaries, ticketCount, openTicketCount, waitlist] =
      await Promise.all([
        Q.player.balance.find({ minecraftUuid: uuid }),
        Q.player.playtime.summary.findAll({ playerMinecraftUuid: uuid }),
        Q.ticket.count({ creatorDiscordId: player.discordId }),
        Q.ticket.count({
          creatorDiscordId: player.discordId,
          status: TicketStatus.OPEN,
        }),
        Q.waitlist.entry.find({ discordId: player.discordId }),
      ]);

    const totalSeconds = playtimeSummaries.reduce(
      (sum, s) => sum + Number(s.totalSeconds),
      0,
    );

    const totalSessions = playtimeSummaries.reduce(
      (sum, s) => sum + s.totalSessions,
      0,
    );

    return {
      player,
      balance,
      playtime: {
        summary: playtimeSummaries,
        totalSeconds,
        totalSessions,
      },
      tickets: {
        total: ticketCount,
        open: openTicketCount,
      },
      waitlist,
    };
  }

  /** Balance row, pre-formatted balance string, and the most recent transactions. */
  async getBalanceInfo(
    identifier: PlayerIdentifier,
    transactionLimit: number = 10,
  ): Promise<{
    balance: PlayerBalance;
    formattedBalance: string;
    recentTransactions: PlayerBalanceTransaction[];
  }> {
    const uuid = await this.resolvePlayerUuid(identifier);

    const [balance, transactions] = await Promise.all([
      Q.player.balance.get({ minecraftUuid: uuid }),
      Q.player.balance.transaction.findAll(
        { playerMinecraftUuid: uuid },
        {
          limit: transactionLimit,
          orderBy:
            DatabaseTable.PLAYER_BALANCE_TRANSACTION.CAMEL_FIELDS.CREATED_AT,
          orderDirection: "desc",
        },
      ),
    ]);

    return {
      balance,
      formattedBalance: BalanceUtils.format(balance.balance),
      recentTransactions: transactions,
    };
  }

  /** Filtered, paginated player list for the admin list view. */
  async getAll(
    filters?: PlayerFilters,
    options?: {
      orderBy?: keyof Player;
      orderDirection?: "asc" | "desc";
      limit?: number;
      offset?: number;
    },
  ): Promise<Player[]> {
    return await Q.player.findAll(filters, options);
  }

  /** Count of players matching the given filters. */
  async count(filters?: PlayerFilters): Promise<number> {
    return await Q.player.count(filters);
  }

  /**
   * Update player fields and write one admin_log_action entry per changed
   * field, all inside a single transaction. Resolves to the post-update row.
   */
  async adminUpdate(
    identifier: PlayerIdentifier,
    updates: {
      minecraftUsername?: string;
      discordId?: string;
    },
    adminDiscordId: string,
    adminUsername: string,
    reason: string,
  ): Promise<Player> {
    const uuid = await this.resolvePlayerUuid(identifier);
    const oldPlayer = await Q.player.get({ minecraftUuid: uuid });

    return await db.inTransaction(async (tx) => {
      await tx.player.update({ minecraftUuid: uuid }, updates);

      for (const [field, newValue] of Object.entries(updates)) {
        const oldValue = oldPlayer[field as keyof Player] as string;

        if (oldValue !== newValue) {
          await tx.admin.log.action.create({
            adminDiscordId,
            adminUsername,
            actionType: AdminEdit.UPDATE_PLAYER,
            targetPlayerUuid: uuid,
            targetPlayerName: oldPlayer.minecraftUsername,
            tableName: DatabaseTable.PLAYER.TABLE,
            fieldName: field,
            oldValue: oldValue?.toString() || null,
            newValue: newValue?.toString() || null,
            reason,
          });
        }
      }

      return await tx.player.get({ minecraftUuid: uuid });
    });
  }

  /**
   * Hard-delete a player and let DB cascades drop balance, transactions,
   * sessions, playtime aggregates, and admin entries. Writes the audit log
   * row before the delete so it survives the cascade.
   */
  async adminDelete(
    identifier: PlayerIdentifier,
    adminDiscordId: string,
    adminUsername: string,
    reason: string,
  ): Promise<void> {
    const uuid = await this.resolvePlayerUuid(identifier);
    const player = await Q.player.get({ minecraftUuid: uuid });

    await db.inTransaction(async (tx) => {
      await tx.admin.log.action.create({
        adminDiscordId,
        adminUsername,
        actionType: AdminEdit.DELETE_PLAYER,
        targetPlayerUuid: uuid,
        targetPlayerName: player.minecraftUsername,
        tableName: DatabaseTable.PLAYER.TABLE,
        fieldName: "deleted",
        oldValue: "false",
        newValue: "true",
        reason,
        metadata: {
          discordId: player.discordId,
          minecraftUsername: player.minecraftUsername,
        },
      });

      await tx.player.delete({ minecraftUuid: uuid });

      logger.info(
        `Admin ${adminUsername} deleted player ${player.minecraftUsername} (${uuid})`,
      );
    });
  }

  /** Dashboard stats: total/online counts, registration trends, balance aggregates. */
  async getStats(): Promise<{
    total: number;
    online: number;
    registered: {
      today: number;
      thisWeek: number;
      thisMonth: number;
    };
    balance: {
      total: string;
      average: string;
      median: string;
    };
  }> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      total,
      online,
      registeredToday,
      registeredThisWeek,
      registeredThisMonth,
      balanceStats,
    ] = await Promise.all([
      Q.player.count(),
      Q.player.count({ online: true }),
      Q.player.count({ createdAt: { $gte: today } }),
      Q.player.count({ createdAt: { $gte: weekAgo } }),
      Q.player.count({ createdAt: { $gte: monthAgo } }),
      Q.player.balance.getAggregateStats(),
    ]);

    return {
      total,
      online,
      registered: {
        today: registeredToday,
        thisWeek: registeredThisWeek,
        thisMonth: registeredThisMonth,
      },
      balance: {
        total: BalanceUtils.format(balanceStats.total),
        average: BalanceUtils.format(balanceStats.average),
        median: BalanceUtils.format(balanceStats.median),
      },
    };
  }
}
