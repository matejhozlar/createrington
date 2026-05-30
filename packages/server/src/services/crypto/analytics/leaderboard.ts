import { Q } from "@/db";

export interface LeaderboardEntry {
  rank: number;
  playerUuid: string;
  playerName: string;
  value: string;
}

type LeaderboardType = "networth" | "pnl" | "volume";

/**
 * Computes the crypto trading leaderboard for the requested metric.
 *
 * Supported leaderboard types:
 * - `networth`: total portfolio value (current holdings × current price)
 * - `pnl`: cumulative realized P&L from sell transactions
 * - `volume`: total trade volume across all transactions
 *
 * @param type - The metric to rank players by
 * @param limit - Maximum number of entries to return (default 10)
 * @returns Ranked leaderboard entries, highest value first
 */
export async function getLeaderboard(
  type: LeaderboardType,
  limit = 10,
): Promise<LeaderboardEntry[]> {
  switch (type) {
    case "networth":
      return getNetworthLeaderboard(limit);
    case "pnl":
      return getPnlLeaderboard(limit);
    case "volume":
      return getVolumeLeaderboard(limit);
  }
}

/**
 * Ranks players by the current market value of their holdings.
 *
 * @private
 * @param limit - Maximum number of entries to return
 * @returns Leaderboard entries sorted by descending net worth
 */
async function getNetworthLeaderboard(
  limit: number,
): Promise<LeaderboardEntry[]> {
  const tokens = await Q.crypto.token.getAll();
  const tokenPriceMap = new Map(tokens.map((t) => [t.id, Number(t.price)]));

  const allHoldings = await Q.crypto.holding.getAll();
  const playerValues = new Map<string, number>();

  for (const h of allHoldings) {
    const price = tokenPriceMap.get(h.tokenId) ?? 0;
    const value = price * Number(h.amount);
    playerValues.set(
      h.playerMinecraftUuid,
      (playerValues.get(h.playerMinecraftUuid) ?? 0) + value,
    );
  }

  return buildLeaderboard(playerValues, limit);
}

/**
 * Ranks players by cumulative realized P&L from all sell transactions.
 *
 * @private
 * @param limit - Maximum number of entries to return
 * @returns Leaderboard entries sorted by descending realized P&L
 */
async function getPnlLeaderboard(limit: number): Promise<LeaderboardEntry[]> {
  const allSells = await Q.crypto.transaction.where({ type: "sell" }).all();

  const playerPnl = new Map<string, number>();

  for (const tx of allSells) {
    if (tx.realizedPnl) {
      playerPnl.set(
        tx.playerMinecraftUuid,
        (playerPnl.get(tx.playerMinecraftUuid) ?? 0) + Number(tx.realizedPnl),
      );
    }
  }

  return buildLeaderboard(playerPnl, limit);
}

/**
 * Ranks players by total absolute trade volume across all transaction types.
 *
 * @private
 * @param limit - Maximum number of entries to return
 * @returns Leaderboard entries sorted by descending volume
 */
async function getVolumeLeaderboard(
  limit: number,
): Promise<LeaderboardEntry[]> {
  const allTxs = await Q.crypto.transaction.getAll();

  const playerVolume = new Map<string, number>();

  for (const tx of allTxs) {
    const cost = Math.abs(Number(tx.totalCost));
    playerVolume.set(
      tx.playerMinecraftUuid,
      (playerVolume.get(tx.playerMinecraftUuid) ?? 0) + cost,
    );
  }

  return buildLeaderboard(playerVolume, limit);
}

/**
 * Sorts a player-value map and resolves Minecraft usernames into ranked entries.
 *
 * Falls back to the UUID string if the player record has no username.
 *
 * @private
 * @param playerValues - Map of player UUID to numeric score
 * @param limit - Maximum number of entries to include
 * @returns Ranked and named leaderboard entries
 */
async function buildLeaderboard(
  playerValues: Map<string, number>,
  limit: number,
): Promise<LeaderboardEntry[]> {
  const sorted = [...playerValues.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  // Resolve player names in a single query rather than per-entry lookups
  const players = await Q.player.getAll();
  const nameMap = new Map(
    players.map((p) => [
      p.minecraftUuid,
      p.minecraftUsername ?? p.minecraftUuid,
    ]),
  );

  return sorted.map(([uuid, value], i) => ({
    rank: i + 1,
    playerUuid: uuid,
    playerName: nameMap.get(uuid) ?? uuid,
    value: value.toFixed(2),
  }));
}
