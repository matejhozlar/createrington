import { db, Q } from "@/db";
import { BalanceTransactionType, type PlayerIdentifier } from "../balance";
import {
  Player,
  PlayerBalance,
  PlayerBalanceTransaction,
  PlayerPlaytimeSummary,
  PlayerSession,
  Ticket,
  WaitlistEntry,
} from "@createrington/shared/db";
import { TicketStatus } from "@/services/discord/tickets";
import { DatabaseTable } from "@/generated/db";
import { BalanceUtils } from "../balance/utils";
import { AdminEdit } from "@/types";

/**
 * Repository for admin player management operations
 *
 * Handles:
 * - Player data retrieval with enriched information
 * - Player updates with audit logging
 * - Player deletion (full cascade)
 * - Balance management (delegates to BalanceRepository)
 * - Statistics and aggregations
 */
export class PlayerRepository {
  constructor() {}

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private async resolvePlayerUuid(
    identifier: PlayerIdentifier,
  ): Promise<string> {
    if (typeof identifier === "string") return identifier;
    if ("minecraftUuid" in identifier && identifier.minecraftUuid) {
      return identifier.minecraftUuid;
    }
    const player = await Q.player.get(identifier);
    return player.minecraftUuid;
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
          orderDirection: "DESC",
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
   * Gets player's session history
   *
   * @param identifier - Player identifier
   * @param serverId - Optional server filter
   * @param limit - Number of sessions to return
   */
  async getSessionHistory(
    identifier: PlayerIdentifier,
    serverId?: number,
    limit: number = 50,
  ): Promise<PlayerSession[]> {
    const uuid = await this.resolvePlayerUuid(identifier);

    return await Q.player.session.findAll(
      {
        playerMinecraftUuid: uuid,
        ...(serverId && { serverId }),
      },
      {
        limit,
        orderBy: DatabaseTable.PLAYER_SESSION.CAMEL_FIELDS.SESSION_START,
        orderDirection: "DESC",
      },
    );
  }

  /**
   * Gets all tickets for a player
   *
   * @param identifier - Player identifier
   */
  async getTickets(identifier: PlayerIdentifier): Promise<Ticket[]> {
    const uuid = await this.resolvePlayerUuid(identifier);
    const player = await Q.player.get({ minecraftUuid: uuid });

    return await Q.ticket.findAll(
      { creatorDiscordId: player.discordId },
      {
        orderBy: DatabaseTable.TICKET.CAMEL_FIELDS.CREATED_AT,
        orderDirection: "DESC",
      },
    );
  }

  /**
   * Gets admin action audit log for a player
   *
   * @param identifier - Player identifier
   * @param limit - Number of actions to return
   */
  async getAuditLog(
    identifier: PlayerIdentifier,
    limit: number = 50,
  ): Promise<
    Array<{
      id: number;
      adminDiscordUsername: string;
      actionType: string;
      tableName: string;
      fieldName: string;
      oldValue: string | null;
      newValue: string | null;
      reason: string | null;
      performedAt: Date;
      metadata: Record<string, any> | null;
    }>
  > {
    const uuid = await this.resolvePlayerUuid(identifier);

    const actions = await Q.admin.log.action.findAll(
      { targetPlayerUuid: uuid },
      {
        limit,
        orderBy: DatabaseTable.ADMIN_LOG_ACTION.CAMEL_FIELDS.PERFORMED_AT,
        orderDirection: "DESC",
      },
    );

    return actions;
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
      orderDirection?: "ASC" | "DESC";
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
    discordId: string;
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
   * @param reason - Promise resolving to a reason for update
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
  // BULK OPERATIONS
  // ============================================================================

  /**
   * Bulk balance adjustement for multiple servers
   *
   * @param playerUuids - Array of player UUIDs
   * @param amount - Amount to adjust (positive = grant, negative = deduct)
   * @param adminDiscordId - Admin performing the action
   * @param adminDiscordUsername - Admin username
   * @param reason - Reason for bulk adjustement
   * @returns Promise resolving to an array of results with success/failure status
   */
  async bulkBalanceAdjust(
    playerUuids: string[],
    amount: number,
    adminDiscordId: string,
    adminDiscordUsername: string,
    reason: string,
  ): Promise<
    Array<{
      playerUuid: string;
      playerUsername: string;
      success: boolean;
      newBalance?: number;
      error?: string;
    }>
  > {
    const results = [];

    for (const uuid of playerUuids) {
      try {
        const player = await Q.player.get({ minecraftUuid: uuid });

        const newBalance =
          amount >= 0
            ? await db.inTransaction(async (tx) => {
                return await tx.player.balance.transaction.createAndReturn({
                  playerMinecraftUuid: uuid,
                  amount: BalanceUtils.toStorage(amount),
                  balanceBefore: (
                    await tx.player.balance.get({ minecraftUuid: uuid })
                  ).balance,
                  balanceAfter:
                    (await tx.player.balance.get({ minecraftUuid: uuid }))
                      .balance + BalanceUtils.toStorage(amount),
                  transactionType: BalanceTransactionType.ADMIN_GRANT,
                  description: reason,
                  metadata: {
                    adminDiscordId,
                    adminDiscordUsername,
                    bulkOperation: true,
                  },
                });
              })
            : await db.inTransaction(async (tx) => {
                return await tx.player.balance.transaction.createAndReturn({
                  playerMinecraftUuid: uuid,
                  amount: BalanceUtils.toStorage(amount),
                  balanceBefore: (
                    await tx.player.balance.get({ minecraftUuid: uuid })
                  ).balance,
                  balanceAfter:
                    (await tx.player.balance.get({ minecraftUuid: uuid }))
                      .balance + BalanceUtils.toStorage(amount),
                  transactionType: BalanceTransactionType.ADMIN_DEDUCT,
                  description: reason,
                  metadata: {
                    adminDiscordId,
                    adminDiscordUsername,
                    bulOperation: true,
                  },
                });
              });

        results.push({
          playerUuid: uuid,
          playerUsername: player.minecraftUsername,
          success: true,
          newBalance: BalanceUtils.fromStorage(newBalance.balanceAfter),
        });
      } catch (error) {
        results.push({
          playerUuid: uuid,
          playerUsername: "Unknown",
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return results;
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
