import { Q } from "@/db";
import { getServiceSync, Services } from "@/services";
import { playerDeletionService } from "@/services/player/deletion";

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
 * 1. Marks the warning row as removed and stamps the player's name and
 *    Discord id on it (must happen first, see below)
 * 2. Kicks the Discord guild member if they're still present
 * 3. Deletes the player and removes them from all Minecraft whitelists via
 *    the deletion service; the removed warning row stays as history, with
 *    its player uuid set to NULL by the foreign key
 *
 * Step 1 runs before step 2 so the `guildMemberRemove` event handler
 * (`leave-notification.ts`) can reliably detect an inactivity-driven
 * departure and skip posting the "member left" notification with a
 * Yeet-from-database button. If we kicked first, the event handler
 * races with step 3 and may observe the player still present with no
 * `removed_at` set, producing a stale notification whose Yeet button
 * fails once the player record is deleted.
 *
 * Discord kick and RCON failures are logged but do not abort the rest
 * of the sequence: the DB delete always runs.
 */
export async function removeInactiveWarning(
  warning: WarningToRemove,
  reason = "Inactivity: 60+ days without logging in",
): Promise<void> {
  await Q.player.inactivity.warning.update(
    { id: warning.id },
    {
      removedAt: new Date(),
      minecraftUsername: warning.minecraftUsername,
      discordId: warning.discordId,
    },
  );

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
    await playerDeletionService.delete(
      { minecraftUuid: warning.playerMinecraftUuid },
      {
        actor: { type: "system" },
        reason,
      },
    );
  } catch (error) {
    logger.error(
      `Failed to delete player ${warning.minecraftUsername}, rolling back removed_at on warning ${warning.id}`,
      error,
    );
    try {
      await Q.player.inactivity.warning.update(
        { id: warning.id },
        { removedAt: null, minecraftUsername: null, discordId: null },
      );
    } catch (rollbackError) {
      logger.error(
        `Failed to roll back removed_at on warning ${warning.id}, row is now in an inconsistent state`,
        rollbackError,
      );
    }
    throw error;
  }

  logger.info(
    `Removed inactive player ${warning.minecraftUsername} (warned ${warning.warnedAt.toISOString()})`,
  );
}
