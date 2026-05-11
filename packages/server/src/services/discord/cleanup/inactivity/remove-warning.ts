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
 * 1. Marks the warning row as removed (must happen first, see below)
 * 2. Kicks the Discord guild member if they're still present
 * 3. Removes the player from all Minecraft server whitelists via RCON
 * 4. Deletes the player record (cascades to the warning row)
 *
 * Step 1 runs before step 2 so the `guildMemberRemove` event handler
 * (`leave-notification.ts`) can reliably detect an inactivity-driven
 * departure and skip posting the "member left" notification with a
 * Yeet-from-database button. If we kicked first, the event handler
 * races with step 4 and may observe the player still present with no
 * `removed_at` set, producing a stale notification whose Yeet button
 * fails once the player record is deleted.
 *
 * We cannot simply reorder the player delete before the kick because
 * the `player_inactivity_warning.player_minecraft_uuid` FK cascades,
 * which would delete the warning row we're trying to update.
 *
 * Discord kick and RCON failures are logged but do not abort the rest
 * of the sequence: the DB delete always runs.
 *
 * @param warning - The warning to process
 * @param reason - Reason string passed to the Discord kick
 */
export async function removeInactiveWarning(
  warning: WarningToRemove,
  reason = "Inactivity: 60+ days without logging in",
): Promise<void> {
  await Q.player.inactivity.warning.markRemoved(warning.id);

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

  try {
    await Q.player.delete({
      minecraftUuid: warning.playerMinecraftUuid,
    });
  } catch (error) {
    // Rollback the markRemoved set above so the warning stays retryable
    // by findExpiredWarnings and the leave-notification handler doesn't
    // indefinitely suppress voluntary departures for this player.
    logger.error(
      `Failed to delete player ${warning.minecraftUsername}, rolling back removed_at on warning ${warning.id}`,
      error,
    );
    try {
      await Q.player.inactivity.warning.clearRemoved(warning.id);
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
