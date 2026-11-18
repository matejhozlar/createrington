import { Q } from "@/db";
import type { PlayerPlaytimeBreakdown } from "@/db/queries/player/playtime/summary";
import { EmbedPresets } from "@/discord/embeds";
import { replyError } from "@/discord/utils/interaction-reply";
import { CooldownType } from "@/discord/utils/cooldown";
import { formatPlaytime } from "@createrington/shared/format";
import {
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("playtime")
  .setDescription("Check playtime of a user")
  .addUserOption((opt) =>
    opt
      .setName("user")
      .setDescription("User to check the playtime for")
      .setRequired(false),
  );

export const cooldown = {
  duration: 5,
  type: CooldownType.USER,
  message: "Please wait before checking playtime again!",
};

export async function execute(interaction: ChatInputCommandInteraction) {
  const userOption = interaction.options.getUser("user", false);
  const targetUser = userOption || interaction.user;

  try {
    const playerEntry = await Q.player.get({ discordId: targetUser.id });
    const breakdown: PlayerPlaytimeBreakdown =
      await Q.player.playtime.summary.getBreakdown(playerEntry.minecraftUuid);

    const topServers = breakdown.servers.slice(0, 5);
    const serverList = topServers
      .map(
        (server) =>
          `**${server.serverName}**: ${formatPlaytime(server.totalSeconds)}`,
      )
      .join("\n");

    const moreServers =
      breakdown.servers.length > 5
        ? `\n*+${breakdown.servers.length - 5} more server${breakdown.servers.length - 5 !== 1 ? "s" : ""}*`
        : "";

    const description = [
      `**Total Playtime**: ${formatPlaytime(breakdown.totals.totalSeconds)}`,
      `**Total Sessions**: ${breakdown.totals.totalSessions.toLocaleString()}`,
      `**Servers Played**: ${breakdown.totals.serverCount}`,
      "",
      "**Breakdown by Server:**",
      serverList + moreServers,
    ].join("\n");

    const embed = EmbedPresets.info(
      `${playerEntry.minecraftUsername}'s Playtime`,
      description,
    );

    await interaction.reply({
      embeds: [embed.build()],
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    logger.error(
      `Failed to fetch playtime for ${targetUser.displayName}:`,
      error,
    );

    await replyError(
      interaction,
      "Playtime Error",
      `Failed to fetch playtime for ${targetUser.displayName}. They may not have any recorded playtime yet.`,
    );
  }
}
