import { db, Q } from "@/db";
import { BalanceUtils } from "../../balance/utils";
import { BalanceTransactionType } from "../../balance";
import { BasePlayerRepository } from "../base";

/**
 * Bulk admin balance adjustments across many players with per-player error
 * isolation: a failure on one UUID is captured in the result row and does
 * not abort the rest of the batch. For single-player operations use
 * BalanceRepository directly.
 */
export class PlayerBalanceRepository extends BasePlayerRepository {
  constructor() {
    super();
  }

  /**
   * Apply the same signed delta to a list of players. Positive amount grants,
   * negative deducts. Returns a parallel result array with success status per
   * UUID (success rows include the new balance, failures include an error).
   */
  async bulkAdjust(
    playerUuids: string[],
    amount: number,
    adminDiscordId: string,
    adminUsername: string,
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
                    adminUsername,
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
                    adminUsername,
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
