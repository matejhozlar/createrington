import { db, Q } from "@/db";
import { BalanceUtils } from "../../balance/utils";
import { BalanceTransactionType } from "../../balance";
import { BasePlayerRepository } from "../base";

/**
 * Repository for player balance operations specific to player context
 *
 * Delegates to BalanceRepository but adds player-specific bulk operations
 * and admin operations with proper player data resolution
 */
export class PlayerBalanceRepository extends BasePlayerRepository {
  constructor() {
    super();
  }

  /**
   * Bulk balance adjustment for multiple players
   *
   * @param playerUuids - Array of player UUIDs
   * @param amount - Amount to adjust (positive = grant, negative = deduct)
   * @param adminDiscordId - Admin performing the action
   * @param adminDiscordUsername - Admin username
   * @param reason - Reason for bulk adjustment
   * @returns Promise resolving to an array of results with success/failure status
   */
  async bulkAdjust(
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
                    bulkOperation: true,
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
}
