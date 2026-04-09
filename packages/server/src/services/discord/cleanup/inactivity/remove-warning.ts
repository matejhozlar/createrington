import { Q } from "@/db";
import { getServiceSync, Services } from "@/services";
import { minecraftRcon, WhitelistAction } from "@/utils/rcon";

/**
 * Minimal warning shape needed for removal. Compatible with both
 * `findExpiredWarnings` rows (from the scheduled path) and
 * `findByIdWithPlayer` rows (from the admin manual path).
 */
export interface WarningToRemove {
  id: number;
  playerMinecraftUuid: string;
  minecraftUsername: string;
  discordId: string;
  warnedAt: Date;
}

/**
 * Runs the full removal sequence for a single inactivity warning:
 *
 * 1. Kicks the Discord guild member if they're still present
 * 2. Removes the player from all Minecraft server whitelists via RCON
 * 3. Deletes the player record (cascades to related tables)
 * 4. Marks the warning row as removed
 *
 * Discord kick and RCON failures are logged but do not abort the rest
 * of the sequence — the DB delete and `markRemoved` update always run.
 *
 * @param warning - The warning to process
 * @param reason - Reason string passed to the Discord kick
 */
export async function removeInactiveWarning(
  warning: WarningToRemove,
  reason = "Inactivity: 60+ days without logging in",
): Promise<void> {
  try {
    const mainBot = getServiceSync(Services.DISCORD_MAIN_BOT);
    const guild = mainBot.guilds.cache.first();
    if (guild) {
      const member = await guild.members
        .fetch(warning.discordId)
        .catch(() => null);
      if (member) {
        await member.kick(reason);
        logger.info(
          `Kicked ${warning.minecraftUsername} from Discord (${reason})`,
        );
      }
    }
  } catch (error) {
    logger.warn(
      `Failed to kick ${warning.minecraftUsername} from Discord:`,
      error,
    );
  }

  try {
    await minecraftRcon.whitelistAll(
      WhitelistAction.REMOVE,
      warning.minecraftUsername,
    );
  } catch (error) {
    logger.error(
      `Failed to remove ${warning.minecraftUsername} from whitelist:`,
      error,
    );
  }

  await Q.player.delete({
    minecraftUuid: warning.playerMinecraftUuid,
  });

  await Q.player.inactivity.warning.markRemoved(warning.id);

  logger.info(
    `Removed inactive player ${warning.minecraftUsername} (warned ${warning.warnedAt.toISOString()})`,
  );
}
