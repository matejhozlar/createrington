import { db, Q } from "@/db/pool";
import { DatabaseTable } from "@/generated/db";
import type {
  Player,
  PlayerBalance,
  PlayerBalanceTransaction,
  PlayerPlaytimeSummary,
  WaitlistEntry,
} from "@createrington/shared/db";
import { BalanceUtils } from "@/db/utils/balance";
import { BasePlayerRepository, type PlayerIdentifier } from "./base";
import { denyLauncherPlayer } from "@/services/auth/launcher/launcher-token-denylist";

/**
 * Core player CRUD plus the aggregate read paths used by the admin panel
 * (detailed lookup, balance summary, server-wide stats).
 * adminUpdate writes an admin_log_action audit row inside the same
 * transaction. Player deletion is owned by PlayerDeletionService.
 */
export class PlayerRepository extends BasePlayerRepository {
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
          status: "open",
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

  /**
   * Update player fields and write one admin_log_action entry per changed
   * field, all inside a single transaction. A Discord ID change also revokes
   * the old account's web sessions and moves its Discord-keyed rows in that
   * transaction. A Minecraft UUID change moves the UUID-keyed rows without a
   * foreign key and links votes cast under the new username. Either change
   * revokes the player's launcher sessions in the transaction and then denies
   * the launcher access tokens issued under the old UUID. Resolves to the
   * post-update row.
   */
  async adminUpdate(
    identifier: PlayerIdentifier,
    updates: {
      minecraftUsername?: string;
      minecraftUuid?: string;
      discordId?: string;
    },
    adminDiscordId: string,
    adminUsername: string,
    reason: string,
  ): Promise<Player> {
    const uuid = await this.resolvePlayerUuid(identifier);
    const oldPlayer = await Q.player.get({ minecraftUuid: uuid });
    const relinkedTo =
      updates.discordId && updates.discordId !== oldPlayer.discordId
        ? updates.discordId
        : null;
    const newUuid = updates.minecraftUuid ?? uuid;
    const signsOutLauncher = relinkedTo !== null || newUuid !== uuid;

    const updated = await db.inTransaction(async (tx) => {
      if (relinkedTo) {
        await tx.auth.session.updateAll(
          { revokedAt: new Date() },
          { discordId: oldPlayer.discordId, revokedAt: { $exists: false } },
        );
      }

      if (signsOutLauncher) {
        await tx.auth.launcher.session.updateAll(
          { revokedAt: new Date() },
          { playerMinecraftUuid: uuid, revokedAt: null },
        );
      }

      await tx.player.update({ minecraftUuid: uuid }, updates);

      if (relinkedTo) {
        await tx.player.reassignDiscordId(oldPlayer.discordId, relinkedTo);
      }

      if (newUuid !== uuid) {
        await tx.player.reassignMinecraftUuid(uuid, newUuid);
      }

      if (updates.minecraftUsername) {
        await tx.player.vote.linkUsername(updates.minecraftUsername, newUuid);
      }

      for (const [field, newValue] of Object.entries(updates)) {
        const oldValue = oldPlayer[field as keyof Player] as string;

        if (oldValue !== newValue) {
          await tx.admin.log.action.create({
            adminDiscordId,
            adminUsername,
            actionType: "update_player",
            targetPlayerUuid: newUuid,
            targetPlayerName: oldPlayer.minecraftUsername,
            tableName: DatabaseTable.PLAYER.TABLE,
            fieldName: field,
            oldValue: oldValue?.toString() || null,
            newValue: newValue?.toString() || null,
            reason,
          });
        }
      }

      return await tx.player.get({ minecraftUuid: newUuid });
    });

    if (signsOutLauncher) {
      try {
        await denyLauncherPlayer(uuid);
      } catch (error) {
        logger.error(
          `Failed to deny the launcher access tokens of moved player ${oldPlayer.minecraftUsername}:`,
          error,
        );
      }
    }

    return updated;
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
