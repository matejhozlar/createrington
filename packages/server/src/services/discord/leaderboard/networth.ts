import { formatBalance } from "@/utils/format";
import type { LeaderboardEntry } from "./types";

/**
 * Ranks the top players by in-game balance.
 *
 * @param balances - In-game balances keyed by player UUID
 * @param nameByUuid - Player UUID to display name
 * @param limit - Maximum number of ranked entries to return
 */
export function rankNetWorth(
  balances: Array<{ minecraftUuid: string; balance: number }>,
  nameByUuid: Map<string, string>,
  limit: number,
): LeaderboardEntry[] {
  return [...balances]
    .sort((a, b) => b.balance - a.balance)
    .slice(0, limit)
    .map(({ minecraftUuid, balance }, index) => ({
      rank: index + 1,
      playerName: nameByUuid.get(minecraftUuid) ?? minecraftUuid,
      playerUuid: minecraftUuid,
      value: balance.toFixed(2),
      formattedValue: formatBalance(balance),
    }));
}
