import { Q } from "@/db";
import { minecraftRcon } from "@/utils/rcon";
import { discordTimestamp } from "@/utils/format";
import { Discord } from "@/discord/constants";
import { EmbedColors, EmbedPresets } from "@/discord/embeds";
import type { Client } from "discord.js";
import type { PlayerBan } from "@createrington/shared/db";

/**
 * Auto-unbans expired temporary bans on a recurring interval (5 min). On each
 * tick it updates the DB row, pardons the player on every Minecraft server via
 * RCON, writes an admin-log entry, and posts a Discord notification. Requires
 * a Discord client and is driven by `initialize()` / `shutdown()`.
 */
export class PlayerBanService {
  private unbanCheckInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 5 * 60 * 1000;

  constructor(private readonly discordClient: Client) {}

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
    let minecraftUsername = "Unknown";
    let wasDeleted = false;

    try {
      const player = await Q.player.find({
        minecraftUuid: ban.playerMinecraftUuid,
      });
      if (player) {
        minecraftUsername = player.minecraftUsername;
      }
    } catch {
      minecraftUsername =
        ban.metadata?.minecraftUsername || "Unknown (Deleted)";
      wasDeleted = true;
    }

    const updatedBan = await Q.player.ban.updateAndReturn(
      { id: ban.id },
      {
        unbanned: true,
        unbannedByDiscordId: "system",
        unbannedByUsername: "System",
        unbannedAt: new Date(),
        unbanReason: "Temporary ban expired",
      },
    );

    await Q.admin.log.action.create({
      adminDiscordId: "system",
      adminUsername: "System",
      actionType: "unban_player" as string,
      targetPlayerUuid: ban.playerMinecraftUuid,
      targetPlayerName: minecraftUsername,
      tableName: "player_ban",
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

    if (!wasDeleted && minecraftUsername !== "Unknown") {
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
    }

    try {
      await this.notifyAutoUnban(updatedBan, minecraftUsername, wasDeleted);
    } catch (error) {
      logger.error("Failed to send auto-unban notification:", error);
    }

    logger.info(`Auto-unbanned ban #${ban.id} for ${minecraftUsername}`);
  }

  private async notifyAutoUnban(
    ban: PlayerBan,
    minecraftUsername: string,
    wasDeleted: boolean,
  ): Promise<void> {
    const embed = EmbedPresets.plain({
      title: "✅ Player Auto-Unbanned (Expired)",
      description: [
        `**Player**: ${minecraftUsername}`,
        `**Original ban reason**: ${ban.reason}`,
        `**Banned at**: ${discordTimestamp(ban.bannedAt, "F")}`,
        `**Ban duration**: ${this.calculateDuration(ban.bannedAt, ban.expiresAt!)}`,
        wasDeleted ? `\n⚠️ *Player data was previously deleted*` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      color: EmbedColors.Success,
    });

    await Discord.Messages.send({
      channelId: Discord.Channels.administration.NOTIFICATIONS,
      embeds: embed.build(),
    });
  }

  private calculateDuration(start: Date, end: Date): string {
    const durationMs = end.getTime() - start.getTime();
    const days = Math.floor(durationMs / (24 * 60 * 60 * 1000));
    const hours = Math.floor(
      (durationMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000),
    );

    if (days > 0) {
      return hours > 0
        ? `${days} day${days !== 1 ? "s" : ""} and ${hours} hour${hours !== 1 ? "s" : ""}`
        : `${days} day${days !== 1 ? "s" : ""}`;
    }

    return `${hours} hour${hours !== 1 ? "s" : ""}`;
  }

  /** Triggers an immediate expired-ban sweep outside the recurring interval. */
  async checkNow(): Promise<void> {
    logger.info("Manual check for expired bans triggered");
    await this.checkExpiredBans();
  }

  /** Returns runtime stats: running flag, interval, next check ISO string, and pending expired-ban count. */
  async getStats(): Promise<{
    isRunning: boolean;
    checkInterval: number;
    nextCheck: string;
    expiredBansCount: number;
  }> {
    const expiredBans = await Q.player.ban.getExpiredBans();

    return {
      isRunning: this.unbanCheckInterval !== null,
      checkInterval: this.CHECK_INTERVAL,
      nextCheck: this.unbanCheckInterval
        ? new Date(Date.now() + this.CHECK_INTERVAL).toISOString()
        : "Not running",
      expiredBansCount: expiredBans.length,
    };
  }

  /** Clears the recurring expired-ban interval. Safe to call multiple times. */
  async shutdown(): Promise<void> {
    if (this.unbanCheckInterval) {
      clearInterval(this.unbanCheckInterval);
      this.unbanCheckInterval = null;
    }
    logger.info("PlayerBanService shutdown");
  }
}
