import config from "@/config";
import { Q } from "@/db";
import { trpcError } from "@/trpc/utils";
import type { PlayerIdObject } from "@/utils/player-identifier";

export async function requireOwnerForAdminTarget(
  target: PlayerIdObject,
  callerDiscordId: string,
  action: string,
): Promise<void> {
  const ownerDiscordId = config.app.auth.owner.discordId;
  if (callerDiscordId === ownerDiscordId) return;

  const player = await Q.player.find(target);
  if (!player) return;

  if (
    player.discordId === ownerDiscordId ||
    (await Q.admin.exists({ discordId: player.discordId }))
  ) {
    throw trpcError.forbidden(`Only the owner can ${action} an admin`);
  }
}
