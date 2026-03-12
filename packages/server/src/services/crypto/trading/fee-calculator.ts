/**
 * Trading fee calculator for the crypto market.
 * Applies category-specific base rates with volume-based discounts.
 * Event modifiers (tax holiday, liquidity drought) are applied on top.
 */

import { CRYPTO_CONFIG } from "../crypto.config";
import type { CryptoTokenCategory } from "@createrington/shared/db/database.types";
import { getEventFeeMultiplier } from "../events/event-engine";

/** Returns the base fee rate for a token category (0 for stablecoins, up to 2.5% for memecoins) */
export function getBaseFeeRate(category: CryptoTokenCategory): number {
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

/**
 * Returns the highest applicable volume discount based on lifetime trade count.
 *
 * @param lifetimeTradeCount - Player's total historical trade count
 * @returns Discount multiplier between 0 and 0.3 (e.g. 0.3 = 30% fee reduction)
 */
export function getVolumeDiscount(lifetimeTradeCount: number): number {
  let discount = 0;
  // Tiers are ordered ascending — each match overwrites, leaving the highest qualifying discount
  for (const tier of CRYPTO_CONFIG.VOLUME_DISCOUNTS) {
    if (lifetimeTradeCount >= tier.minTrades) {
      discount = tier.discount;
    }
  }
  return discount;
}

/** Fee discount granted by the Market Veteran achievement (5% additional reduction) */
export const MARKET_VETERAN_FEE_DISCOUNT = 0.05;

/**
 * Calculates the trading fee for a transaction.
 * Applies the category base rate, reduced by the player's volume discount
 * and Market Veteran achievement bonus, then multiplied by any active event
 * fee modifier (e.g. tax holiday = 0, liquidity drought = 2x).
 *
 * @param totalCost - Raw cost of the trade before fees
 * @param category - Token category determining the base fee rate
 * @param lifetimeTradeCount - Player's total historical trade count for discount lookup
 * @param hasMarketVeteran - Whether the player has the Market Veteran achievement
 * @returns Fee amount in currency units
 */
export function calculateFee(
  totalCost: number,
  category: CryptoTokenCategory,
  lifetimeTradeCount: number,
  hasMarketVeteran = false,
): number {
  const baseFeeRate = getBaseFeeRate(category);
  if (baseFeeRate === 0) return 0;

  const volumeDiscount = getVolumeDiscount(lifetimeTradeCount);
  const achievementDiscount = hasMarketVeteran
    ? MARKET_VETERAN_FEE_DISCOUNT
    : 0;
  const totalDiscount = Math.min(volumeDiscount + achievementDiscount, 1);
  const effectiveRate = baseFeeRate * (1 - totalDiscount);
  const eventMultiplier = getEventFeeMultiplier();
  return totalCost * effectiveRate * eventMultiplier;
}
