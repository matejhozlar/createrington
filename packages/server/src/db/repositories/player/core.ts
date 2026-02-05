import { db, Q } from "@/db";
import { DatabaseTable } from "@/generated/db";
import type {
  Player,
  PlayerBalance,
  PlayerBalanceTransaction,
  PlayerPlaytimeSummary,
  WaitlistEntry,
} from "@createrington/shared/db";
import { TicketStatus } from "@/services/discord/tickets";
import { BalanceUtils } from "../balance/utils";
import { AdminEdit } from "@/types";
import { BasePlayerRepository, type PlayerIdentifier } from "./base";

/**
 * Repository for core player data operations
 *
 * Handles:
 * - Player CRUD operations
 * - Detailed player info retrieval
 * - Player listing and filtering
 * - Statistics and aggregations
 */
export class PlayerRepository extends BasePlayerRepository {
  constructor() {
    super();
  }

  // ============================================================================
  // PLAYER RETRIEVAL
  // ============================================================================

  /**
   * Gets detailed player information for admin panel
   * Includes balance, playtime summary, and other related data
   *
   * @param identifier - Player identifier
   * @returns Promise resolving to enriched player data
   */
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

  /**
   * Get's player's balance information with recent transactions
   *
   * @param identifier - Player identifier
   * @param transactionLimit - Number of recent transactions to include
   */
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

  /**
   * Gets all players with filtering and pagination
   * (For admin list view)
   */
  async getAll(
    filters?: {
      discordId?: string;
      minecraftUuid?: string;
      minecraftUsername?: { $ilike: string };
      online?: boolean;
    },
    options?: {
      orderBy?: keyof Player;
      orderDirection?: "asc" | "desc";
      limit?: number;
      offset?: number;
    },
  ): Promise<Player[]> {
    return await Q.player.findAll(filters, options);
  }

  /**
   * Counts players matching filters
   */
  async count(filters?: {
    discordId?: string;
    minecraftUuid?: string;
    minecraftUsername?: { $ilike: string };
    online?: boolean;
  }): Promise<number> {
    return await Q.player.count(filters);
  }

  // ============================================================================
  // PLAYER UPDATES
  // ============================================================================

  /**
   * Updates player data with admin audit logging
   *
   * @param identifier - Player identifier
   * @param updates - Fields to update
   * @param adminDiscordId - Admin performing the action
   * @param adminDiscordUsername - Admin username
   * @param reason - Reason for update
   */
  async adminUpdate(
    identifier: PlayerIdentifier,
    updates: {
      minecraftUsername?: string;
      discordId?: string;
    },
    adminDiscordId: string,
    adminDiscordUsername: string,
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
            adminDiscordUsername,
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

  // ============================================================================
  // PLAYER DELETION
  // ============================================================================

  /**
   * Completely deletes a player and all associated data
   * Cascades to:
   * - player_balance
   * - player_balance_transaction
   * - player_session
   * - player_playtime_*
   * - admin entries (if player is admin)
   *
   * @param identifier - Player identifier
   * @param adminDiscordId - Admin performing the deletion
   * @param adminDiscordUsername - Admin username
   * @param reason - Reason for deletion
   */
  async adminDelete(
    identifier: PlayerIdentifier,
    adminDiscordId: string,
    adminDiscordUsername: string,
    reason: string,
  ): Promise<void> {
    const uuid = await this.resolvePlayerUuid(identifier);
    const player = await Q.player.get({ minecraftUuid: uuid });

    await db.inTransaction(async (tx) => {
      await tx.admin.log.action.create({
        adminDiscordId,
        adminDiscordUsername,
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
        `Admin ${adminDiscordUsername} deleted player ${player.minecraftUsername} (${uuid})`,
      );
    });
  }

  // ============================================================================
  // STATISTICS
  // ============================================================================

  /**
   * Gets overall player statistics for admin dashboard
   */
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
      balances,
    ] = await Promise.all([
      Q.player.count(),
      Q.player.count({ online: true }),
      Q.player.count({ createdAt: { $gte: today } }),
      Q.player.count({ createdAt: { $gte: weekAgo } }),
      Q.player.count({ createdAt: { $gte: monthAgo } }),
      Q.player.balance.getAll(),
    ]);

    const totalBalance = balances.reduce(
      (sum, b) => sum + b.balance,
      BigInt(0),
    );

    const avgBalance =
      balances.length > 0 ? totalBalance / BigInt(balances.length) : BigInt(0);

    const sortedBalances = balances
      .map((b) => b.balance)
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const medianBalance =
      sortedBalances.length > 0
        ? sortedBalances[Math.floor(sortedBalances.length / 2)]
        : BigInt(0);

    return {
      total,
      online,
      registered: {
        today: registeredToday,
        thisWeek: registeredThisWeek,
        thisMonth: registeredThisMonth,
      },
      balance: {
        total: BalanceUtils.format(totalBalance),
        average: BalanceUtils.format(avgBalance),
        median: BalanceUtils.format(medianBalance),
      },
    };
  }
}
