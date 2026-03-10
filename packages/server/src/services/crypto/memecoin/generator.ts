import { Q } from "@/db";
import { CRYPTO_CONFIG } from "../crypto.config";
import { MEMECOIN_CATALOG } from "./catalog";
import type { CryptoToken } from "@createrington/shared/db/crypto_token.types";

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomInt(min: number, max: number): number {
  return Math.floor(randomBetween(min, max + 1));
}

async function getUsedSymbols(): Promise<Set<string>> {
  const tokens = await Q.crypto.token.where({}).all();
  return new Set(tokens.map((t) => t.symbol));
}

export async function generateMemecoin(): Promise<CryptoToken | null> {
  const usedSymbols = await getUsedSymbols();

  // Find an unused memecoin from the catalog
  const available = MEMECOIN_CATALOG.filter(
    (m) => !usedSymbols.has(m.symbol),
  );

  if (available.length === 0) {
    logger.warn("No unused memecoin definitions available in catalog");
    return null;
  }

  const definition = available[randomInt(0, available.length - 1)];

  const price = randomBetween(
    CRYPTO_CONFIG.MEMECOIN_INITIAL_PRICE_MIN,
    CRYPTO_CONFIG.MEMECOIN_INITIAL_PRICE_MAX,
  );

  const totalSupply = BigInt(
    randomInt(
      CRYPTO_CONFIG.MEMECOIN_TOTAL_SUPPLY_MIN,
      CRYPTO_CONFIG.MEMECOIN_TOTAL_SUPPLY_MAX,
    ),
  );

  const token = await Q.crypto.token.createAndReturn({
    name: definition.name,
    symbol: definition.symbol,
    description: definition.description,
    category: "memecoin",
    totalSupply,
    availableSupply: totalSupply,
    price: price.toFixed(8),
  });

  logger.info(
    `New memecoin listed: ${definition.name} (${definition.symbol}) at $${price.toFixed(8)}`,
  );

  return token;
}

export async function cleanupCrashedTokens(): Promise<number> {
  const cutoff = new Date(
    Date.now() - CRYPTO_CONFIG.MEMECOIN_CRASH_CLEANUP_HOURS * 60 * 60 * 1000,
  );

  const crashed = await Q.crypto.token
    .where({
      isCrashed: true,
      category: "memecoin",
    })
    .all();

  let cleaned = 0;
  for (const token of crashed) {
    if (token.crashedAt && token.crashedAt <= cutoff) {
      // Delete holdings for this token
      const holdings = await Q.crypto.holding
        .where({ tokenId: token.id })
        .all();

      for (const holding of holdings) {
        await Q.crypto.holding.delete({ id: holding.id });
      }

      // Delete price snapshots
      const snapshots = await Q.crypto.price.snapshot
        .where({ tokenId: token.id })
        .all();

      for (const snapshot of snapshots) {
        await Q.crypto.price.snapshot.delete({ id: snapshot.id });
      }

      // Delete the token
      await Q.crypto.token.delete({ id: token.id });
      cleaned++;

      logger.info(
        `Cleaned up crashed memecoin: ${token.name} (${token.symbol})`,
      );
    }
  }

  return cleaned;
}
