/**
 * Fee treasury bookkeeping for the crypto market.
 * Routes collected trade fees into the singleton treasury row,
 * burning a portion of memecoin fees per FEES.BURN_RATIO.
 */

import { Q } from "@/db";
import type { CryptoQueries } from "@/db/queries/crypto";
import { cryptoSetting } from "../settings/accessor";

/**
 * Credits a collected trade fee to the treasury, creating the singleton row on
 * first collection. For memecoins, FEES.BURN_RATIO of the fee is burned instead
 * of collected.
 *
 * @param feeAmount - Total fee collected from the trade
 * @param category - Token category (memecoins burn a share of the fee)
 * @param txCrypto - Optional transaction-bound CryptoQueries for atomic operations
 */
export async function updateTreasury(
  feeAmount: number,
  category: string,
  txCrypto?: CryptoQueries,
): Promise<void> {
  const burnAmount =
    category === "memecoin" ? feeAmount * cryptoSetting("FEES.BURN_RATIO") : 0;
  const collectedAmount = feeAmount - burnAmount;

  const crypto = txCrypto ?? Q.crypto;
  const treasury = await crypto.treasury.where({}).first();
  if (treasury) {
    await crypto.treasury.update(
      { id: treasury.id },
      {
        totalCollected: (
          Number(treasury.totalCollected) + collectedAmount
        ).toFixed(8),
        totalBurned: (Number(treasury.totalBurned) + burnAmount).toFixed(8),
        updatedAt: new Date(),
      },
    );
  } else {
    await crypto.treasury.create({
      totalCollected: collectedAmount.toFixed(8),
      totalBurned: burnAmount.toFixed(8),
    });
  }
}
