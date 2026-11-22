import { Q } from "@/db";
import { SYSTEM_AUDIT_ACTOR } from "@/db/queries/admin/log/action";
import { DatabaseTable } from "@/generated/db";
import { minecraftRcon } from "@/utils/rcon";
import { discordTimestamp, formatDuration } from "@/utils/format";
import { Discord } from "@/discord/constants";
import { EmbedColors, EmbedPresets } from "@/discord/embeds";
import type { PlayerBan } from "@createrington/shared/db";

/**
 * Auto-unbans expired temporary bans on a recurring interval (5 min). On each
 * tick it updates the DB row, pardons the player on every Minecraft server via
 * RCON, writes an admin-log entry, and posts a Discord notification. Driven
 * by `initialize()` / `shutdown()`.
 */
export class PlayerBanService {
  private unbanCheckInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 5 * 60 * 1000;

  /** Runs an immediate expired-ban sweep, then arms the 5-minute interval. */
  async initialize(): Promise<void> {
    await this.checkExpiredBans();

    this.unbanCheckInterval = setInterval(() => {
      this.checkExpiredBans().catch((error) => {
        logger.error("Failed to check expired bans:", error);
      });
    }, this.CHECK_INTERVAL);

    logger.info(
      "PlayerBanService initialized with auto-unban checker (checks every 5 minutes)",
    );
  }

  private async checkExpiredBans(): Promise<void> {
    try {
      const expiredBans = await Q.player.ban.getExpiredBans();

      if (expiredBans.length === 0) {
        return;
      }

      logger.info(`Found ${expiredBans.length} expired ban(s) to process`);

      for (const ban of expiredBans) {
        try {
          await this.processExpiredBan(ban);
        } catch (error) {
          logger.error(`Failed to auto-unban expired ban #${ban.id}:`, error);
        }
      }

      logger.info(`Processed ${expiredBans.length} expired ban(s)`);
    } catch (error) {
      logger.error("Failed to check for expired bans:", error);
      throw error;
    }
  }

  private async processExpiredBan(ban: PlayerBan): Promise<void> {
    const { minecraftUsername } = await Q.player.get({
      minecraftUuid: ban.playerMinecraftUuid,
    });

    const updatedBan = await Q.player.ban.updateAndReturn(
      { id: ban.id },
      {
        unbanned: true,
        unbannedByDiscordId: SYSTEM_AUDIT_ACTOR.discordId,
        unbannedByUsername: SYSTEM_AUDIT_ACTOR.username,
        unbannedAt: new Date(),
        unbanReason: "Temporary ban expired",
      },
    );

    await Q.admin.log.action.create({
      adminDiscordId: SYSTEM_AUDIT_ACTOR.discordId,
      adminUsername: SYSTEM_AUDIT_ACTOR.username,
      actionType: "unban_player",
      targetPlayerUuid: ban.playerMinecraftUuid,
      targetPlayerName: minecraftUsername,
      tableName: DatabaseTable.PLAYER_BAN.TABLE,
      fieldName: "unbanned",
      oldValue: "false",
      newValue: "true",
      reason: "Temporary ban expired",
      serverId: ban.serverId || undefined,
      metadata: {
        banId: ban.id,
        originalBanType: ban.banType,
        originalReason: ban.reason,
        automatic: true,
      },
    });

    try {
      await minecraftRcon.pardonAll(minecraftUsername);
      logger.info(
        `Auto-pardoned ${minecraftUsername} on all Minecraft servers (ban #${ban.id})`,
      );
    } catch (error) {
      logger.error(
        `Failed to pardon ${minecraftUsername} on Minecraft servers:`,
        error,
      );
    }

    try {
      await this.notifyAutoUnban(updatedBan, minecraftUsername);
    } catch (error) {
      logger.error("Failed to send auto-unban notification:", error);
    }

    logger.info(`Auto-unbanned ban #${ban.id} for ${minecraftUsername}`);
  }

  private async notifyAutoUnban(
    ban: PlayerBan,
    minecraftUsername: string,
  ): Promise<void> {
    const embed = EmbedPresets.plain({
      title: "✅ Player Auto-Unbanned (Expired)",
      description: [
        `**Player**: ${minecraftUsername}`,
        `**Original ban reason**: ${ban.reason}`,
        `**Banned at**: ${discordTimestamp(ban.bannedAt, "F")}`,
        `**Ban duration**: ${formatDuration(ban.bannedAt, ban.expiresAt!)}`,
      ].join("\n"),
      color: EmbedColors.Success,
    });

    await Discord.Messages.send({
      channelId: Discord.Channels.administration.NOTIFICATIONS,
      embeds: embed.build(),
    });
  }

  /** Clears the recurring expired-ban interval. Safe to call multiple times. */
  shutdown(): void {
    if (this.unbanCheckInterval) {
      clearInterval(this.unbanCheckInterval);
      this.unbanCheckInterval = null;
    }
    logger.info("PlayerBanService shutdown");
  }
}
