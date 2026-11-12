import type { PlayerBan } from "@createrington/shared/db";

export interface BannedPlayer {
  name: string | null;
  wasDeleted: boolean;
}

export function resolveBannedPlayer(
  ban: Pick<PlayerBan, "metadata">,
  player: { minecraftUsername: string } | null,
): BannedPlayer {
  if (player) {
    return { name: player.minecraftUsername, wasDeleted: false };
  }

  const stored: unknown = ban.metadata?.minecraftUsername;
  return {
    name: typeof stored === "string" && stored ? stored : null,
    wasDeleted: true,
  };
}

export function bannedPlayerLabel(player: BannedPlayer): string {
  return player.name ?? "Unknown (Deleted)";
}
