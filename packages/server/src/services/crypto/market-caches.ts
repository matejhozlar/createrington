import { Q } from "@/db";

/**
 * Encapsulates rolling 24-hour market state used for change% and volume lookups.
 *
 * Caches are populated from the DB via `refreshPrices` / `refreshVolumes` and
 * queried synchronously by the market service when building broadcast payloads.
 */
export class MarketCaches {
  /** In-memory cache of 24h-ago prices for change% calculation */
  private prices24hAgo = new Map<number, number>();

  /** In-memory cache of 24h trade volume per token */
  private volume24h = new Map<number, bigint>();

  /**
   * Loads the price each token had ~24 hours ago from minute snapshots.
   * Falls back to the oldest available snapshot when no data exists in the
   * 24h window.
   */
  async refreshPrices(): Promise<void> {
    const tokens = await Q.crypto.token.where({}).all();
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    // A window: between 24h ago and 23h ago to find the closest snapshot
    const windowEnd = new Date(cutoff.getTime() + 60 * 60 * 1000);

    for (const token of tokens) {
      const snapshots = await Q.crypto.price.snapshot
        .where({ tokenId: token.id, interval: "minute" })
        .all();

      // Find the snapshot closest to 24h ago
      const candidates = snapshots.filter(
        (s) => s.recordedAt >= cutoff && s.recordedAt <= windowEnd,
      );

      if (candidates.length > 0) {
        // Pick the one closest to the cutoff
        candidates.sort(
          (a, b) =>
            Math.abs(a.recordedAt.getTime() - cutoff.getTime()) -
            Math.abs(b.recordedAt.getTime() - cutoff.getTime()),
        );
        this.prices24hAgo.set(token.id, Number(candidates[0].closePrice));
      } else if (snapshots.length > 0) {
        // Use the oldest available snapshot
        snapshots.sort(
          (a, b) => a.recordedAt.getTime() - b.recordedAt.getTime(),
        );
        this.prices24hAgo.set(token.id, Number(snapshots[0].closePrice));
      }
    }
  }

  /**
   * Calculates the total trade volume per token over the last 24 hours.
   * Sums absolute transaction amounts to capture both buys and sells.
   */
  async refreshVolumes(): Promise<void> {
    const tokens = await Q.crypto.token.where({}).all();
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    for (const token of tokens) {
      const transactions = await Q.crypto.transaction
        .where({ tokenId: token.id })
        .all();

      const recentTxs = transactions.filter((t) => t.createdAt >= cutoff);
      let totalVolume = 0n;
      for (const tx of recentTxs) {
        totalVolume += tx.amount < 0n ? -tx.amount : tx.amount;
      }
      this.volume24h.set(token.id, totalVolume);
    }
  }

  /**
   * Computes the 24h price change percentage for a token.
   * @param tokenId - Token to look up in the 24h price cache
   * @param currentPrice - Current price as a decimal string
   * @returns Percentage change (e.g. 12.5 for +12.5%), or 0 if no baseline exists
   */
  getChange(tokenId: number, currentPrice: string): number {
    const oldPrice = this.prices24hAgo.get(tokenId);
    if (!oldPrice || oldPrice === 0) return 0;
    return ((Number(currentPrice) - oldPrice) / oldPrice) * 100;
  }

  /** Returns the total 24h trading volume across all tokens */
  getTotalVolume(): bigint {
    let total = 0n;
    for (const vol of this.volume24h.values()) {
      total += vol;
    }
    return total;
  }

  /** Returns the 24h trading volume for a specific token */
  getTokenVolume(tokenId: number): bigint {
    return this.volume24h.get(tokenId) ?? 0n;
  }
}
