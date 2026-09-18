import { playerRepo } from "@/db";
import { EmbedPresets } from "@/discord/embeds";
import { replyError } from "@/discord/utils/interaction-reply";
import { CooldownType } from "@/discord/utils/cooldown";
import { formatPlaytime } from "@createrington/shared/format";
import { renderScreenshot } from "@/discord/utils/render-screenshot";
import {
  AttachmentBuilder,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";

/**
 * Slash command definition for the activity command
 * Displays a GitHub-style playtime heatmap for a player
 */
export const data = new SlashCommandBuilder()
  .setName("activity")
  .setDescription("View a player's activity heatmap")
  .addUserOption((opt) =>
    opt
      .setName("player")
      .setDescription("The player to view (defaults to you)")
      .setRequired(false),
  );

/**
 * Cooldown configuration for the activity command
 */
export const cooldown = {
  duration: 5,
  type: CooldownType.USER,
  message: "Please wait before viewing activity again!",
};

/**
 * Executes the activity command to generate a playtime heatmap
 */
export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const targetUser =
    interaction.options.getUser("player", false) || interaction.user;

  await interaction.deferReply();

  try {
    const details = await playerRepo.getDetailed({ discordId: targetUser.id });
    const username = details.player.minecraftUsername;

    const screenshotBuffer = await renderScreenshot("activity", {
      player: targetUser.id,
    });

    if (screenshotBuffer) {
      const attachment = new AttachmentBuilder(screenshotBuffer, {
        name: `activity_${username}.png`,
      });

      const embed = EmbedPresets.info(`${username}'s Activity`).image(
        `attachment://activity_${username}.png`,
      );

      await interaction.editReply({
        embeds: [embed.build()],
        files: [attachment],
      });
    } else {
      // Text fallback
      const pt = formatPlaytime(details.playtime.totalSeconds);
      const sessions = details.playtime.totalSessions.toLocaleString();

      const embed = EmbedPresets.info(`${username}'s Activity`)
        .thumbnail(
          `https://mc-heads.net/avatar/${details.player.minecraftUuid}`,
        )
        .field("Total Playtime", pt, true)
        .field("Sessions", sessions, true);

      await interaction.editReply({ embeds: [embed.build()] });
    }
  } catch {
    await replyError(
      interaction,
      "Activity Error",
      "Could not fetch player data. They may not be registered.",
    );
  }
}
