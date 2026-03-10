import { CRYPTO_CONFIG } from "../crypto.config";
import type { CryptoTokenCategory } from "@createrington/shared/db/database.types";

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

export function getVolumeDiscount(lifetimeTradeCount: number): number {
  let discount = 0;
  for (const tier of CRYPTO_CONFIG.VOLUME_DISCOUNTS) {
    if (lifetimeTradeCount >= tier.minTrades) {
      discount = tier.discount;
    }
  }
  return discount;
}

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
