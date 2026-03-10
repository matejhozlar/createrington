import { Q } from "@/db";
import { CRYPTO_CONFIG, type VolatilityTier } from "../crypto.config";
import type { CryptoToken } from "@createrington/shared/db/crypto_token.types";

export interface PriceUpdate {
  tokenId: number;
  symbol: string;
  oldPrice: string;
  newPrice: string;
  isCrashed: boolean;
}

function getVolatilityTier(price: number): VolatilityTier {
  const tiers = CRYPTO_CONFIG.VOLATILITY;
  if (price < tiers.PENNY.maxPrice) return "PENNY";
  if (price < tiers.LOW.maxPrice) return "LOW";
  if (price < tiers.MID.maxPrice) return "MID";
  if (price < tiers.HIGH.maxPrice) return "HIGH";
  return "MEGA";
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function calculateMemecoinPriceChange(currentPrice: number): number {
  const tier = getVolatilityTier(currentPrice);
  const { minChange, maxChange } = CRYPTO_CONFIG.VOLATILITY[tier];

  const volatility = randomBetween(minChange, maxChange);
  const direction =
    Math.random() < CRYPTO_CONFIG.MEMECOIN_UPWARD_BIAS ? 1 : -1;

  return direction * volatility;
}

export function tickMemecoinPrice(token: CryptoToken): PriceUpdate {
  const currentPrice = Number(token.price);
  const change = calculateMemecoinPriceChange(currentPrice);
  let newPrice = currentPrice * (1 + change);

  const isCrashed = newPrice < CRYPTO_CONFIG.MEMECOIN_CRASH_THRESHOLD;
  if (isCrashed) {
    newPrice = 0;
  }

  // Ensure price doesn't go negative
  newPrice = Math.max(0, newPrice);

  return {
    tokenId: token.id,
    symbol: token.symbol,
    oldPrice: token.price,
    newPrice: newPrice.toFixed(8),
    isCrashed,
  };
}

export function tickStablecoinPrice(
  token: CryptoToken,
  activePlayerCount: number,
): PriceUpdate {
  const currentPrice = Number(token.price);
  const floorPrice = token.floorPrice
    ? Number(token.floorPrice)
    : CRYPTO_CONFIG.STABLECOIN_FLOOR_PRICE;

  let priceChange: number;
  if (activePlayerCount > 0) {
    priceChange =
      CRYPTO_CONFIG.STABLECOIN_INFLATION_PER_PLAYER * activePlayerCount;
  } else {
    priceChange = -CRYPTO_CONFIG.STABLECOIN_DECAY_RATE;
  }

  const newPrice = Math.max(floorPrice, currentPrice * (1 + priceChange));

  return {
    tokenId: token.id,
    symbol: token.symbol,
    oldPrice: token.price,
    newPrice: newPrice.toFixed(8),
    isCrashed: false,
  };
}

export async function applyPriceUpdate(update: PriceUpdate): Promise<void> {
  if (update.isCrashed) {
    await Q.crypto.token.update(
      { id: update.tokenId },
      {
        price: update.newPrice,
        isCrashed: true,
        crashedAt: new Date(),
      },
    );
  } else {
    await Q.crypto.token.update(
      { id: update.tokenId },
      { price: update.newPrice },
    );
  }
}

export async function recordTickSnapshot(
  update: PriceUpdate,
  volume: bigint = 0n,
): Promise<void> {
  const price = update.newPrice;
  const now = new Date();
  // Round to nearest 30s boundary
  now.setMilliseconds(0);
  now.setSeconds(now.getSeconds() - (now.getSeconds() % 30));

  await Q.crypto.price.snapshot.create({
    tokenId: update.tokenId,
    interval: "tick",
    openPrice: update.oldPrice,
    highPrice:
      Number(update.newPrice) > Number(update.oldPrice)
        ? update.newPrice
        : update.oldPrice,
    lowPrice:
      Number(update.newPrice) < Number(update.oldPrice)
        ? update.newPrice
        : update.oldPrice,
    closePrice: price,
    volume,
    recordedAt: now,
  });
}
