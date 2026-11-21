import { userMention } from "discord.js";
import { EmbedColors } from "../../colors";
import { createEmbed } from "../../embed-builder";
import { discordTimestamp, pluralize } from "@/utils/format";

export interface InactivePlayerInfo {
  discordId: string;
  minecraftUsername: string;
  lastSeen: Date;
}

export const InactivityEmbedPresets = {
  warning(data: { players: InactivePlayerInfo[]; deadlineDate: Date }) {
    const playerLines = data.players.map((p) => {
      return `- ${userMention(p.discordId)} (\`${p.minecraftUsername}\`) - last seen ${discordTimestamp(p.lastSeen, "R")}`;
    });

    const description = [
      `The following players have not logged into the server for **60+ days**. They have until ${discordTimestamp(data.deadlineDate, "F")} (${discordTimestamp(data.deadlineDate, "R")}) to log back in, otherwise they will be **removed from the server**.`,
      "",
      ...playerLines,
    ].join("\n");

    const truncatedDescription =
      description.length > 4096
        ? `${description.slice(0, 4050)}\n\n...and ${data.players.length} players total`
        : description;

    return createEmbed()
      .title("Inactivity Warning")
      .description(truncatedDescription)
      .color(EmbedColors.Warning)
      .footer("Log into the server to clear this warning")
      .timestamp();
  },

  adminRemoval(data: {
    players: string[];
    triggeredBy: { discordId: string; username: string | null } | null;
    removedAt: Date;
  }) {
    const triggeredByLine = data.triggeredBy
      ? `${userMention(data.triggeredBy.discordId)}${data.triggeredBy.username ? ` (\`${data.triggeredBy.username}\`)` : ""}`
      : "Automated";

    const playerLines = data.players
      .map((username) => `- \`${username}\``)
      .join("\n");

    const description = [
      `**${data.players.length}** inactive ${pluralize(data.players.length, "player")} removed at ${discordTimestamp(data.removedAt, "F")}.`,
      `**Triggered by:** ${triggeredByLine}`,
      "",
      playerLines,
    ].join("\n");

    const truncatedDescription =
      description.length > 4096
        ? `${description.slice(0, 4050)}\n\n...and ${data.players.length} players total`
        : description;

    return createEmbed()
      .title("Inactivity Removal")
      .description(truncatedDescription)
      .color(EmbedColors.Error)
      .timestamp();
  },

  removed(data: { players: string[]; removedAt: Date }) {
    const playerLines = data.players
      .map((username) => `- \`${username}\``)
      .join("\n");

    const description = [
      `The following players have been removed from the server due to inactivity. Their grace period expired on ${discordTimestamp(data.removedAt, "F")}.`,
      "",
      playerLines,
    ].join("\n");

    const truncatedDescription =
      description.length > 4096
        ? `${description.slice(0, 4050)}\n\n...and ${data.players.length} players total`
        : description;

    return createEmbed()
      .title("Inactive Players Removed")
      .description(truncatedDescription)
      .color(EmbedColors.Error)
      .timestamp();
  },
};
