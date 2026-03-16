/**
 * FIFO cost basis tracker for crypto holdings.
 * Records purchase lots and consumes them in order on sells
 * to calculate accurate realized P&L.
 */

import { Q } from "@/db";
import type { CryptoQueries } from "@/db/queries/crypto";

/**
 * Records a new cost basis lot when a player buys tokens.
 * Each buy creates a separate lot with the purchase price.
 *
 * @param playerUuid - Minecraft UUID of the buying player
 * @param tokenId - Token that was purchased
 * @param amount - Number of tokens in this lot
 * @param pricePerUnit - Price paid per token, stored as a fixed-precision string
 * @param txCrypto - Optional transaction-bound CryptoQueries for atomic operations
 */
export async function recordCostBasisLot(
  playerUuid: string,
  tokenId: number,
  amount: bigint,
  pricePerUnit: string,
  txCrypto?: CryptoQueries,
): Promise<void> {
  const crypto = txCrypto ?? Q.crypto;
  await crypto.cost.basis.create({
    playerMinecraftUuid: playerUuid,
    tokenId,
    amountRemaining: amount,
    pricePerUnit,
  });
}

/**
 * Consumes cost basis lots in FIFO order when a player sells tokens.
 * Oldest lots are consumed first; fully consumed lots are deleted,
 * partially consumed lots have their remaining amount reduced.
 *
 * @param playerUuid - Minecraft UUID of the seller
 * @param tokenId - Token being sold
 * @param sellAmount - Number of tokens being sold
 * @param txCrypto - Optional transaction-bound CryptoQueries for atomic operations
 * @returns Total cost basis consumed (used to calculate realized P&L)
 */
export async function consumeCostBasis(
  playerUuid: string,
  tokenId: number,
  sellAmount: bigint,
  txCrypto?: CryptoQueries,
): Promise<number> {
  const crypto = txCrypto ?? Q.crypto;
  const lots = await crypto.cost.basis
    .where({
      playerMinecraftUuid: playerUuid,
      tokenId,
    })
    .orderBy("acquiredAt", "asc")
    .all();

  let remaining = sellAmount;
  let totalCostBasis = 0;

  for (const lot of lots) {
    if (remaining <= 0n) break;

    const consumed =
      lot.amountRemaining <= remaining ? lot.amountRemaining : remaining;
    totalCostBasis += Number(consumed) * Number(lot.pricePerUnit);
    remaining -= consumed;

    if (consumed === lot.amountRemaining) {
      // Lot fully consumed — delete it
      await crypto.cost.basis.delete({ id: lot.id });
    } else {
      // Partially consumed — update remaining
      await crypto.cost.basis.update(
        { id: lot.id },
        { amountRemaining: lot.amountRemaining - consumed },
      );
    }
  }

  return totalCostBasis;
}

/**
 * Gets the average cost basis per unit for a player's holdings of a token.
 * Used for portfolio display.
 *
 * @param playerUuid - Minecraft UUID of the player
 * @param tokenId - Token to calculate the average for
 * @returns Weighted average entry price across all open lots, or 0 if none exist
 */
export async function getAverageCostBasis(
  playerUuid: string,
  tokenId: number,
): Promise<number> {
  const lots = await Q.crypto.cost.basis
    .where({
      playerMinecraftUuid: playerUuid,
      tokenId,
    })
    .all();

  if (lots.length === 0) return 0;

  let totalCost = 0;
  let totalAmount = 0n;

  for (const lot of lots) {
    totalCost += Number(lot.amountRemaining) * Number(lot.pricePerUnit);
    totalAmount += lot.amountRemaining;
  }

  if (totalAmount === 0n) return 0;
  return totalCost / Number(totalAmount);
}

/**
 * Deletes all cost basis lots for a player-token pair.
 * Used when cleaning up crashed tokens.
 *
 * @param playerUuid - Minecraft UUID of the player
 * @param tokenId - Token whose lots should be removed
 */
export async function clearCostBasis(
  playerUuid: string,
  tokenId: number,
): Promise<void> {
  const lots = await Q.crypto.cost.basis
    .where({
      playerMinecraftUuid: playerUuid,
      tokenId,
    })
    .all();

  for (const lot of lots) {
    await Q.crypto.cost.basis.delete({ id: lot.id });
  }
}
