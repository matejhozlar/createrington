import type { CooldownStats } from "@/discord/utils/cooldown/cooldown-manager";
import { createEmbed, DiscordEmbedBuilder } from "../../embed-builder";
import { EmbedColors } from "../../colors";
import { type ActiveSession, PlaytimeService } from "@/services/playtime";
import { formatPlaytime } from "@/utils/format";

/** Embed presets for bot slash-command responses (cooldown stats, online player list) */
export const CommandEmbedPresets = {
  /** Displays active cooldown counts grouped by command */
  cooldownStats(stats: CooldownStats): DiscordEmbedBuilder {
    const embed = createEmbed()
      .title("📊 Cooldown Statistics")
      .color(EmbedColors.Info)
      .field("Total Active Cooldowns", stats.totalCooldowns.toString(), true)
      .field("Commands with Cooldowns", stats.totalCommands.toString(), true);

    if (Object.keys(stats.byCommand).length > 0) {
      const commandList = Object.entries(stats.byCommand)
        .map(([cmd, count]) => `\`/${cmd}\`: ${count}`)
        .join("\n");

      embed.field("By Command", commandList || "None");
    }

    return embed;
  },

  /** Displays currently online players sorted alphabetically with session durations */
  list(
    activeSessions: ActiveSession[],
    playtimeService: PlaytimeService,
  ): DiscordEmbedBuilder {
    const onlineCount = activeSessions.length;

    const embed = createEmbed()
      .title("🟢 Online Players")
      .color(onlineCount > 0 ? EmbedColors.Success : EmbedColors.Error)
      .timestamp();

    if (onlineCount === 0) {
      embed.description("No players are currently online.");
      return embed;
    }

    const sortedSessions = activeSessions.sort((a, b) =>
      a.username.localeCompare(b.username),
    );

    const playerList = sortedSessions
      .map((session) => {
        const duration = playtimeService.getSessionDuration(session);
        const durationStr = duration ? formatPlaytime(duration) : "Unknown";

        const playerInfo = `**${session.username}** -${durationStr}`;

        return playerInfo;
      })
      .join("\n");

    embed.description(
      `**${onlineCount}** player${onlineCount !== 1 ? "s" : ""} online\n\n${playerList}`,
    );

    return embed;
  },
};
