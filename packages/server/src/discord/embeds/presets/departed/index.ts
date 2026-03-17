import { EmbedColors } from "../../colors";
import { createEmbed } from "../../embed-builder";

export interface DepartedMemberInfo {
  discordId: string;
  discordTag: string;
  minecraftUsername: string;
  minecraftUuid: string;
  departedAt: Date;
}

export const DepartedEmbedPresets = {
  /**
   * Admin notification when a registered member leaves
   */
  departedMember(info: DepartedMemberInfo) {
    const unixTimestamp = Math.floor(info.departedAt.getTime() / 1000);
    const autoDeleteTimestamp = Math.floor(
      (info.departedAt.getTime() + 30 * 24 * 60 * 60 * 1000) / 1000,
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
      .field("Departed", `<t:${unixTimestamp}:R>`, true)
      .field("Auto-Delete", `<t:${autoDeleteTimestamp}:R>`, true)
      .timestamp();
  },

  /**
   * Updated embed after manual deletion
   */
  deleted(info: {
    minecraftUsername: string;
    deletedBy: string;
    deletedAt: Date;
  }) {
    const unixTimestamp = Math.floor(info.deletedAt.getTime() / 1000);

    return createEmbed()
      .title("✅ Member Deleted")
      .description(
        `**${info.minecraftUsername}** has been removed from the system.`,
      )
      .color(EmbedColors.Success)
      .field("Deleted By", info.deletedBy, true)
      .field("Deleted At", `<t:${unixTimestamp}:F>`, true)
      .footer("This member's data has been permanently removed")
      .timestamp();
  },

  /**
   * Updated embed when a departed member returns to the server
   */
  returned(info: {
    minecraftUsername: string;
    departedAt: Date;
    returnedAt: Date;
  }) {
    const departedTimestamp = Math.floor(info.departedAt.getTime() / 1000);
    const returnedTimestamp = Math.floor(info.returnedAt.getTime() / 1000);

    return createEmbed()
      .title("Member Returned")
      .description(
        `**${info.minecraftUsername}** has rejoined the server. Scheduled deletion has been cancelled.`,
      )
      .color(EmbedColors.Info)
      .field("Departed", `<t:${departedTimestamp}:R>`, true)
      .field("Returned", `<t:${returnedTimestamp}:F>`, true)
      .footer("Departure record cancelled")
      .timestamp();
  },

  /**
   * Updated embed after automatic deletion (30 days)
   */
  autoDeleted(info: {
    minecraftUsername: string;
    departedAt: Date;
    deletedAt: Date;
  }) {
    const departedTimestamp = Math.floor(info.departedAt.getTime() / 1000);
    const deletedTimestamp = Math.floor(info.deletedAt.getTime() / 1000);

    return createEmbed()
      .title("Member Auto-Deleted")
      .description(
        `**${info.minecraftUsername}** was automatically removed after 30 days.`,
      )
      .color(EmbedColors.Success)
      .field("Departed", `<t:${departedTimestamp}:R>`, true)
      .field("Auto-Deleted", `<t:${deletedTimestamp}:F>`, true)
      .footer("30-day grace period expired")
      .timestamp();
  },
};
