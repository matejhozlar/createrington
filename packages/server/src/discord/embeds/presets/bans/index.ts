import { userMention } from "discord.js";
import { EmbedColors } from "../../colors";
import { createEmbed } from "../../embed-builder";
import { discordTimestamp, formatCount, formatDuration } from "@/utils/format";

export const BanEmbedPresets = {
  temporary(data: {
    minecraftUsername: string;
    reason: string;
    bannedByDiscordId: string;
    durationDays: number;
    expiresAt: Date;
  }) {
    return createEmbed()
      .title("⏰ Player Temporarily Banned")
      .description(
        [
          `**Player**: ${data.minecraftUsername}`,
          `**Reason**: ${data.reason}`,
          `**Banned by**: ${userMention(data.bannedByDiscordId)}`,
          `**Duration**: ${formatCount(data.durationDays, "day")}`,
          `**Expires**: ${discordTimestamp(data.expiresAt)}`,
        ].join("\n"),
      )
      .color(EmbedColors.Warning);
  },

  permanent(data: {
    minecraftUsername: string;
    discordId: string;
    discordTag: string;
    reason: string;
    bannedByDiscordId: string;
  }) {
    return createEmbed()
      .title("🔴 Player Permanently Banned")
      .description(
        [
          `**Player**: ${data.minecraftUsername}`,
          `**Discord**: ${data.discordTag} (\`${data.discordId}\`)`,
          `**Reason**: ${data.reason}`,
          `**Banned by**: ${userMention(data.bannedByDiscordId)}`,
          "",
          "⚠️ **All player data has been permanently deleted**",
        ].join("\n"),
      )
      .color(EmbedColors.Error);
  },

  unbanned(data: {
    minecraftUsername: string;
    unbannedByDiscordId: string;
    reason: string;
    originalReason: string;
  }) {
    return createEmbed()
      .title("✅ Player Unbanned")
      .description(
        [
          `**Player**: ${data.minecraftUsername}`,
          `**Unbanned by**: ${userMention(data.unbannedByDiscordId)}`,
          `**Reason**: ${data.reason}`,
          `**Original ban reason**: ${data.originalReason}`,
        ].join("\n"),
      )
      .color(EmbedColors.Success);
  },

  autoUnbanned(data: {
    minecraftUsername: string;
    originalReason: string;
    bannedAt: Date;
    expiresAt: Date;
  }) {
    return createEmbed()
      .title("✅ Player Auto-Unbanned (Expired)")
      .description(
        [
          `**Player**: ${data.minecraftUsername}`,
          `**Original ban reason**: ${data.originalReason}`,
          `**Banned at**: ${discordTimestamp(data.bannedAt, "F")}`,
          `**Ban duration**: ${formatDuration(data.bannedAt, data.expiresAt)}`,
        ].join("\n"),
      )
      .color(EmbedColors.Success);
  },
};
