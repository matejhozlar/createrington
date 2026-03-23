/**
 * Memecoin generation and lifecycle cleanup.
 * Picks unused definitions from the catalog, assigns random pricing
 * and supply, and handles delisting of crashed tokens.
 */

import { Q } from "@/db";
import { CRYPTO_CONFIG } from "../crypto.config";
import { MEMECOIN_CATALOG } from "./catalog";
import type { CryptoToken } from "@createrington/shared/db/crypto_token.types";

/** Returns a random float in [min, max) */
function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Returns a random integer in [min, max] (inclusive) */
function randomInt(min: number, max: number): number {
  return Math.floor(randomBetween(min, max + 1));
}

/** Returns the set of token symbols already in use (active or crashed) */
async function getUsedSymbols(): Promise<Set<string>> {
  const tokens = await Q.crypto.token.where({}).all();
  return new Set(tokens.map((t) => t.symbol));
}

/** Returns the count of active (non-crashed, non-delisted) memecoins */
async function getActiveMemecoinCount(): Promise<number> {
  const tokens = await Q.crypto.token
    .where({
      category: "memecoin",
      isCrashed: false,
      delistedAt: { $exists: false },
    })
    .all();
  return tokens.length;
}

/**
 * Picks an unused catalog definition, randomizes price and supply.
 *
 * @private
 * @returns Token creation params or null if the catalog is exhausted
 */
async function pickRandomMemecoin() {
  const usedSymbols = await getUsedSymbols();

  const available = MEMECOIN_CATALOG.filter((m) => !usedSymbols.has(m.symbol));

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

  return { definition, price, totalSupply };
}

/**
 * Generates a new memecoin from an unused catalog entry with random price and supply.
 * The token starts trading immediately (no IPO).
 * @returns The newly created token, or null if all catalog entries are in use
 */
export async function generateMemecoin(): Promise<CryptoToken | null> {
  const activeCount = await getActiveMemecoinCount();
  if (activeCount >= CRYPTO_CONFIG.MEMECOIN_MAX_ACTIVE) {
    logger.info(
      `Memecoin limit reached (${activeCount}/${CRYPTO_CONFIG.MEMECOIN_MAX_ACTIVE}), skipping generation`,
    );
    return null;
  }

  const pick = await pickRandomMemecoin();
  if (!pick) return null;

  const { definition, price, totalSupply } = pick;

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

/**
 * Generates a new memecoin with an IPO phase: a fixed-price buying window
 * during which each player can buy at most IPO_MAX_ALLOCATION_PERCENT of supply.
 * @returns The newly created IPO token, or null if the catalog is exhausted
 */
export async function generateIpoMemecoin(): Promise<CryptoToken | null> {
  const activeCount = await getActiveMemecoinCount();
  if (activeCount >= CRYPTO_CONFIG.MEMECOIN_MAX_ACTIVE) {
    logger.info(
      `Memecoin limit reached (${activeCount}/${CRYPTO_CONFIG.MEMECOIN_MAX_ACTIVE}), skipping IPO generation`,
    );
    return null;
  }

  const pick = await pickRandomMemecoin();
  if (!pick) return null;

  const { definition, price, totalSupply } = pick;

  const ipoEndsAt = new Date(Date.now() + CRYPTO_CONFIG.IPO_DURATION_MS);

  const token = await Q.crypto.token.createAndReturn({
    name: definition.name,
    symbol: definition.symbol,
    description: definition.description,
    category: "memecoin",
    totalSupply,
    availableSupply: totalSupply,
    price: price.toFixed(8),
    ipoEndsAt,
    ipoPrice: price.toFixed(8),
  });

  logger.info(
    `IPO launched: ${definition.name} (${definition.symbol}) at $${price.toFixed(8)}, ends ${ipoEndsAt.toISOString()}`,
  );

  return token;
}

/**
 * Deletes crashed memecoins older than the cleanup threshold,
 * along with their holdings and price snapshots.
 * @returns Number of tokens cleaned up
 */
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
      const holdings = await Q.crypto.holding
        .where({ tokenId: token.id })
        .all();

      for (const holding of holdings) {
        await Q.crypto.holding.delete({ id: holding.id });
      }

      // Clean up transactions
      const transactions = await Q.crypto.transaction
        .where({ tokenId: token.id })
        .all();

      for (const tx of transactions) {
        await Q.crypto.transaction.delete({ id: tx.id });
      }

      // Clean up orders
      const orders = await Q.crypto.order
        .where({ tokenId: token.id })
        .all();

      for (const order of orders) {
        await Q.crypto.order.delete({ id: order.id });
      }

      // Clean up cost basis lots
      const costBasisLots = await Q.crypto.cost.basis
        .where({ tokenId: token.id })
        .all();

      for (const lot of costBasisLots) {
        await Q.crypto.cost.basis.delete({ id: lot.id });
      }

      // Clean up watchlist entries
      const watchlistEntries = await Q.crypto.watchlist
        .where({ tokenId: token.id })
        .all();

      for (const entry of watchlistEntries) {
        await Q.crypto.watchlist.delete({ id: entry.id });
      }

      // Clean up price alerts
      const alerts = await Q.crypto.price.alert
        .where({ tokenId: token.id })
        .all();

      for (const alert of alerts) {
        await Q.crypto.price.alert.delete({ id: alert.id });
      }

      const snapshots = await Q.crypto.price.snapshot
        .where({ tokenId: token.id })
        .all();

      for (const snapshot of snapshots) {
        await Q.crypto.price.snapshot.delete({ id: snapshot.id });
      }

      // Clean up market events
      const events = await Q.crypto.market.event
        .where({ tokenId: token.id })
        .all();

      for (const event of events) {
        await Q.crypto.market.event.delete({ id: event.id });
      }

      await Q.crypto.token.delete({ id: token.id });
      cleaned++;

      logger.info(
        `Cleaned up crashed memecoin: ${token.name} (${token.symbol})`,
      );
    }
  }

  return cleaned;
}
