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
      return `- <@${p.discordId}> (\`${p.minecraftUsername}\`) - last seen <t:${lastSeenUnix}:R>`;
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
   * Admin-facing embed posted to #admin-notifications after an inactivity
   * removal run. Mirrors the public `removed` embed's player list but
   * additionally names who triggered the run (admin mention or
   * "Automated" for the scheduled cycle / startup sweep).
   */
  adminRemoval(data: {
    players: string[];
    triggeredBy: { discordId: string; username: string | null } | null;
    removedAt: Date;
  }) {
    const removedUnix = Math.floor(data.removedAt.getTime() / 1000);

    const triggeredByLine = data.triggeredBy
      ? `<@${data.triggeredBy.discordId}>${data.triggeredBy.username ? ` (\`${data.triggeredBy.username}\`)` : ""}`
      : "Automated";

    const playerLines = data.players
      .map((username) => `- \`${username}\``)
      .join("\n");

    const description = [
      `**${data.players.length}** inactive player${data.players.length === 1 ? "" : "s"} removed at <t:${removedUnix}:F>.`,
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
      .color(EmbedColors.Error)
      .timestamp();
  },
};
