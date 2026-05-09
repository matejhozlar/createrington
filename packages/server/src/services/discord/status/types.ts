import config from "@/config";
import { R } from "@/db";
import { formatPlaytime } from "@/utils/format";
import type { CryptoMarketService } from "@/services/crypto";

export interface StatusConfig {
  /** Fallback text shown when the dynamic resolver throws or returns null */
  text: string;
  dynamic?: () => Promise<string | null> | string | null;
}

/**
 * Discord caps custom-status state at 128 characters. We truncate well below
 * that to leave room for any future suffix and avoid silent server-side trims.
 */
export const MAX_STATUS_LENGTH = 120;

export interface MainBotStatusDeps {
  cryptoMarket: CryptoMarketService;
}

/**
 * Live-data statuses for the main bot, rotated on a fixed interval
 */
export function buildMainBotStatuses(deps: MainBotStatusDeps): StatusConfig[] {
  const { cryptoMarket } = deps;

  return [
    {
      text: "Markets steady",
      dynamic: async () => {
        const { topGainer } = await cryptoMarket.getTopMovers();
        if (!topGainer) return null;
        return `$${topGainer.symbol} ${formatChange(topGainer.change24h)}`;
      },
    },
    {
      text: "Markets steady",
      dynamic: async () => {
        const { topLoser } = await cryptoMarket.getTopMovers();
        if (!topLoser) return null;
        return `$${topLoser.symbol} ${formatChange(topLoser.change24h)}`;
      },
    },
    {
      text: "No grinders today, yet",
      dynamic: async () => {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const top = await R.playtimeRepo.getTopPlayersByDateRange(
          config.servers.cogs.id,
          startOfDay,
          endOfDay,
          1,
        );
        const winner = top[0];
        if (!winner || winner.totalSeconds <= 0) return null;
        return `Today's grinder: ${winner.minecraftUsername} (${formatPlaytime(winner.totalSeconds)})`;
      },
    },
  ];
}

function formatChange(change: number): string {
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(1)}%`;
}
