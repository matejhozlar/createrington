import {
  getLeaderboardConfig,
  type LeaderboardEntry,
  LeaderboardType,
} from "@/services/discord/leaderboard";
import { createEmbed } from "../../embed-builder";
import { EmbedColors } from "../../colors";

export const LeaderboardEmbedPresets = {
  /**
   * Creates a leaderboard display embed
   */
  display(type: LeaderboardType, entries: LeaderboardEntry[]) {
    const config = getLeaderboardConfig(type);

    const embed = createEmbed()
      .title(config.title)
      .description(config.description)
      .color(EmbedColors.Premium)
      .timestamp();

    if (entries.length === 0) {
      embed.field("No Data", "No players have been tracked yet");
      return embed;
    }

    const medals = ["🥇", "🥈", "🥉"];
    const leaderboardText = entries
      .map((entry) => {
        const medal =
          entry.rank <= 3 ? medals[entry.rank - 1] : `${entry.rank}.`;
        return `${medal} **${entry.playerName}** - ${entry.formattedValue}`;
      })
      .join("\n");

    embed.field("Rankings", leaderboardText);

    return embed;
  },
};
