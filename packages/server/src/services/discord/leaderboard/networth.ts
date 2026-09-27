import { formatBalance } from "@/utils/format";
import type { LeaderboardEntry } from "./types";

export function toNetWorthEntries(
  rows: Array<{
    minecraftUuid: string;
    minecraftUsername: string;
    balance: number;
  }>,
): LeaderboardEntry[] {
  return rows.map(({ minecraftUuid, minecraftUsername, balance }, index) => ({
    rank: index + 1,
    playerName: minecraftUsername,
    playerUuid: minecraftUuid,
    value: balance.toFixed(2),
    formattedValue: formatBalance(balance),
  }));
}
