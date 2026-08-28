import config from "@/config";
import { R } from "@/db";
import { formatPlaytime } from "@/utils/format";

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

/**
 * Live-data statuses for the main bot, rotated on a fixed interval
 */
export function buildMainBotStatuses(): StatusConfig[] {
  return [
    {
      text: "No grinders today, yet",
      dynamic: async () => {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const top = await R.playtimeRepo.getTopPlayersByDateRange(
          config.servers.rails.id,
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
