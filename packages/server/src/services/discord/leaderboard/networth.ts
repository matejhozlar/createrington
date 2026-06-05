import { formatBalance } from "@/utils/format";
import type { LeaderboardEntry } from "./types";

/**
 * Merges per-player crypto holding value with in-game balances and ranks the
 * top players by combined net worth.
 *
 * @param holdingValues - Crypto holding value keyed by player UUID
 * @param balances - In-game balances keyed by player UUID
 * @param nameByUuid - Player UUID to display name
 * @param limit - Maximum number of ranked entries to return
 */
export function rankNetWorth(
  holdingValues: Map<string, number>,
  balances: Array<{ minecraftUuid: string; balance: number }>,
  nameByUuid: Map<string, string>,
  limit: number,
): LeaderboardEntry[] {
  const balanceByUuid = new Map(
    balances.map(({ minecraftUuid, balance }) => [minecraftUuid, balance]),
  );

  const totals = new Map<string, number>(holdingValues);
  for (const [uuid, balance] of balanceByUuid) {
    totals.set(uuid, (totals.get(uuid) ?? 0) + balance);
  }

  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([uuid, value], index) => {
      const balance = balanceByUuid.get(uuid) ?? 0;
      const crypto = holdingValues.get(uuid) ?? 0;

      return {
        rank: index + 1,
        playerName: nameByUuid.get(uuid) ?? uuid,
        playerUuid: uuid,
        value: value.toFixed(2),
        formattedValue: formatBalance(value),
        subtitle: `${formatBalance(balance)} balance • ${formatBalance(crypto)} crypto`,
      };
    });
}
