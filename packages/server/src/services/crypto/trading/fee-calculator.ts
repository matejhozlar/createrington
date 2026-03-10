/**
 * Trading fee calculator for the crypto market.
 * Applies category-specific base rates with volume-based discounts.
 */

import { CRYPTO_CONFIG } from "../crypto.config";
import type { CryptoTokenCategory } from "@createrington/shared/db/database.types";

/** Returns the base fee rate for a token category (0 for stablecoins, up to 2.5% for memecoins) */
export function getBaseFeeRate(
  category: CryptoTokenCategory,
): number {
  switch (category) {
    case "stable":
      return CRYPTO_CONFIG.FEES.STABLE;
    case "blue_chip":
      return CRYPTO_CONFIG.FEES.BLUE_CHIP;
    case "memecoin":
      return CRYPTO_CONFIG.FEES.MEMECOIN;
    case "seasonal":
      return CRYPTO_CONFIG.FEES.SEASONAL;
    default:
      return 0;
  }
}

/** Returns the highest applicable volume discount (0-0.3) based on lifetime trade count */
export function getVolumeDiscount(lifetimeTradeCount: number): number {
  let discount = 0;
  for (const tier of CRYPTO_CONFIG.VOLUME_DISCOUNTS) {
    if (lifetimeTradeCount >= tier.minTrades) {
      discount = tier.discount;
    }
  }
  return discount;
}

/**
 * Calculates the trading fee for a transaction.
 * Applies the category base rate reduced by the player's volume discount.
 *
 * @param totalCost - Raw cost of the trade before fees
 * @param category - Token category determining the base fee rate
 * @param lifetimeTradeCount - Player's total historical trade count for discount lookup
 * @returns Fee amount in currency units
 */
export function calculateFee(
  totalCost: number,
  category: CryptoTokenCategory,
  lifetimeTradeCount: number,
): number {
  const baseFeeRate = getBaseFeeRate(category);
  if (baseFeeRate === 0) return 0;

  const discount = getVolumeDiscount(lifetimeTradeCount);
  const effectiveRate = baseFeeRate * (1 - discount);
  return totalCost * effectiveRate;
}
