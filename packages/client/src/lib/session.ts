import type { PlayerData } from "@createrington/shared/socket";

export function getSessionSeconds(player: PlayerData): number {
  const start =
    player.sessionStart instanceof Date
      ? player.sessionStart.getTime()
      : new Date(player.sessionStart).getTime();
  return Math.max(0, (Date.now() - start) / 1000);
}
