import { Q } from "@/db";
import type { CryptoPortfolioSnapshot } from "@createrington/shared/db/crypto_portfolio_snapshot.types";

/**
 * Takes a daily portfolio snapshot for all players with crypto holdings.
 *
 * For each player, computes total portfolio value at current prices, total
 * amount invested (cost basis), and cumulative realized P&L from all past
 * sells, then persists a snapshot record.
 *
 * NOTE: Intended to be called once per day (e.g. at 04:00 by CryptoMarketService).
 *
 * @returns The number of player snapshots written
 */
export async function takeDailySnapshots(): Promise<number> {
  const tokens = await Q.crypto.token.getAll();
  const tokenPriceMap = new Map(tokens.map((t) => [t.id, Number(t.price)]));

  // Fetch all holdings once and partition by player to avoid N+1 queries
  const allHoldings = await Q.crypto.holding.getAll();
  const playerUuids = [
    ...new Set(allHoldings.map((h) => h.playerMinecraftUuid)),
  ];

  let snapshotCount = 0;

  for (const playerUuid of playerUuids) {
    const holdings = allHoldings.filter(
      (h) => h.playerMinecraftUuid === playerUuid,
    );

    let totalValue = 0;
    let totalInvested = 0;

    for (const h of holdings) {
      const price = tokenPriceMap.get(h.tokenId) ?? 0;
      totalValue += price * Number(h.amount);
      totalInvested += Number(h.totalCostBasis);
    }

    // Sum realized P&L from all sells
    const allSells = await Q.crypto.transaction
      .where({ playerMinecraftUuid: playerUuid, type: "sell" })
      .all();
    const realizedPnl = allSells.reduce(
      (sum, tx) => sum + (tx.realizedPnl ? Number(tx.realizedPnl) : 0),
      0,
    );

    await Q.crypto.portfolio.snapshot.create({
      playerMinecraftUuid: playerUuid,
      totalValue: totalValue.toFixed(8),
      totalInvested: totalInvested.toFixed(8),
      realizedPnl: realizedPnl.toFixed(8),
      tokenCount: holdings.length,
    });

    snapshotCount++;
  }

  return snapshotCount;
}

/**
 * Returns portfolio snapshots for a player, ordered chronologically.
 *
 * Fetches up to `limit` most recent snapshots and reverses the result so
 * entries are returned oldest-first, suitable for charting.
 *
 * @param playerUuid - Minecraft UUID of the player
 * @param limit - Maximum number of snapshots to return (default 90)
 * @returns Snapshots ordered from oldest to newest
 */
export async function getPortfolioHistory(
  playerUuid: string,
  limit = 90,
): Promise<CryptoPortfolioSnapshot[]> {
  const snapshots = await Q.crypto.portfolio.snapshot
    .where({ playerMinecraftUuid: playerUuid })
    .orderBy("recordedAt", "desc")
    .limit(limit)
    .all();

  // Reverse so the array is chronological (oldest → newest) for chart rendering
  return snapshots.reverse();
}
