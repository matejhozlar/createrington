import config from "@/config";
import { playtimeRepo } from "@/db";
import { formatPlaytime } from "@createrington/shared/format";

export interface StatusConfig {
  text: string;
  dynamic?: () => Promise<string | null> | string | null;
}

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

        const top = await playtimeRepo.getTopPlayersByDateRange(
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
