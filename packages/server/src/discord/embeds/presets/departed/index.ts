import { userMention } from "discord.js";
import { EmbedColors } from "../../colors";
import { createEmbed } from "../../embed-builder";
import { discordTimestamp } from "@/utils/format";

export interface DepartedMemberInfo {
  discordId: string;
  discordTag: string;
  minecraftUsername: string;
  minecraftUuid: string;
  departedAt: Date;
}

export const DepartedEmbedPresets = {
  departedMember(info: DepartedMemberInfo) {
    const autoDeleteDate = new Date(
      info.departedAt.getTime() + 30 * 24 * 60 * 60 * 1000,
    );

    return createEmbed()
      .title("👋 Registered Member Departed")
      .description(
        `A registered player has left the Discord server. Their account will be automatically deleted in 30 days unless you take action.`,
      )
      .color(EmbedColors.Warning)
      .field("Discord User", `${info.discordTag}`, true)
      .field("Discord ID", `\`${info.discordId}\``, true)
      .field("Minecraft Username", `\`${info.minecraftUsername}\``, true)
      .field("Minecraft UUID", `\`${info.minecraftUuid}\``, true)
      .field("Departed", discordTimestamp(info.departedAt, "R"), true)
      .field("Auto-Delete", discordTimestamp(autoDeleteDate, "R"), true)
      .timestamp();
  },

  deleted(info: {
    minecraftUsername: string;
    deletedBy: { discordId: string; username: string | null };
    deletedAt: Date;
  }) {
    const deletedByLine = `${userMention(info.deletedBy.discordId)}${info.deletedBy.username ? ` (\`${info.deletedBy.username}\`)` : ""}`;

    return createEmbed()
      .title("✅ Member Deleted")
      .description(
        `**${info.minecraftUsername}** has been removed from the system.`,
      )
      .color(EmbedColors.Success)
      .field("Deleted By", deletedByLine, true)
      .field("Deleted At", discordTimestamp(info.deletedAt, "F"), true)
      .footer("This member's data has been permanently removed")
      .timestamp();
  },

  returned(info: {
    minecraftUsername: string;
    departedAt: Date;
    returnedAt: Date;
  }) {
    return createEmbed()
      .title("Member Returned")
      .description(
        `**${info.minecraftUsername}** has rejoined the server. Scheduled deletion has been cancelled.`,
      )
      .color(EmbedColors.Info)
      .field("Departed", discordTimestamp(info.departedAt, "R"), true)
      .field("Returned", discordTimestamp(info.returnedAt, "F"), true)
      .footer("Departure record cancelled")
      .timestamp();
  },

  relinked(info: {
    minecraftUsername: string;
    departedAt: Date;
    cancelledAt: Date;
  }) {
    return createEmbed()
      .title("Departure Cancelled")
      .description(
        `**${info.minecraftUsername}** is now registered to a different Discord account. Scheduled deletion has been cancelled.`,
      )
      .color(EmbedColors.Info)
      .field("Departed", discordTimestamp(info.departedAt, "R"), true)
      .field("Cancelled", discordTimestamp(info.cancelledAt, "F"), true)
      .footer("Departure record cancelled")
      .timestamp();
  },

  autoDeleted(info: {
    minecraftUsername: string;
    departedAt: Date;
    deletedAt: Date;
  }) {
    return createEmbed()
      .title("Member Auto-Deleted")
      .description(
        `**${info.minecraftUsername}** was automatically removed after 30 days.`,
      )
      .color(EmbedColors.Success)
      .field("Departed", discordTimestamp(info.departedAt, "R"), true)
      .field("Auto-Deleted", discordTimestamp(info.deletedAt, "F"), true)
      .footer("30-day grace period expired")
      .timestamp();
  },
};
