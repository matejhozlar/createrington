import { EmbedColors } from "../../colors";
import { createEmbed } from "../../embed-builder";

export interface InactivePlayerInfo {
  discordId: string;
  minecraftUsername: string;
  lastSeen: Date;
}

export const InactivityEmbedPresets = {
  /**
   * Warning embed sent to announcements when inactive players are detected.
   * Lists all warned players with their Discord mentions and last-seen timestamps.
   */
  warning(data: { players: InactivePlayerInfo[]; deadlineDate: Date }) {
    const deadlineUnix = Math.floor(data.deadlineDate.getTime() / 1000);

    const playerLines = data.players.map((p) => {
      const lastSeenUnix = Math.floor(p.lastSeen.getTime() / 1000);
      return `- <@${p.discordId}> (\`${p.minecraftUsername}\`) — last seen <t:${lastSeenUnix}:R>`;
    });

    const description = [
      `The following players have not logged into the server for **60+ days**. They have until <t:${deadlineUnix}:F> (<t:${deadlineUnix}:R>) to log back in, otherwise they will be **removed from the server**.`,
      "",
      ...playerLines,
    ].join("\n");

    // Discord embed description limit is 4096 characters
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

  /**
   * Announcement embed when inactive players are removed after their grace period expired.
   */
  removed(data: { players: string[]; removedAt: Date }) {
    const removedUnix = Math.floor(data.removedAt.getTime() / 1000);

    const playerLines = data.players
      .map((username) => `- \`${username}\``)
      .join("\n");

    const description = [
      `The following players have been removed from the server due to inactivity. Their grace period expired on <t:${removedUnix}:F>.`,
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
      .color(EmbedColors.Moderation)
      .timestamp();
  },
};
