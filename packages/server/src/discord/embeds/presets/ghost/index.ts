import { EmbedColors } from "../../colors";
import { createEmbed } from "../../embed-builder";
import { discordTimestamp } from "@/utils/format";

export const GhostEmbedPresets = {
  /**
   * Admin-facing embed posted to #admin-notifications after a ghost-member
   * removal. Mirrors the inactivity admin-removal embed: target username,
   * removal timestamp, and who triggered the action.
   */
  adminRemoval(data: {
    target: { discordId: string; minecraftUsername: string };
    triggeredBy: { discordId: string; username: string | null };
    removedAt: Date;
  }) {
    const triggeredByLine = `<@${data.triggeredBy.discordId}>${data.triggeredBy.username ? ` (\`${data.triggeredBy.username}\`)` : ""}`;

    const description = [
      `**1** ghost member removed at ${discordTimestamp(data.removedAt, "F")}.`,
      `**Triggered by:** ${triggeredByLine}`,
      "",
      `- <@${data.target.discordId}> (\`${data.target.minecraftUsername}\`)`,
    ].join("\n");

    return createEmbed()
      .title("Ghost Member Removal")
      .description(description)
      .color(EmbedColors.Error)
      .timestamp();
  },
};
