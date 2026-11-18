import { playerRepo } from "@/db";
import { nullIfNotFound } from "@/db/utils";
import { EmbedPresets } from "@/discord/embeds";
import { replyNotRegistered } from "@/discord/utils/interaction-reply";
import { CooldownType } from "@/discord/utils/cooldown";
import { formatPlaytime } from "@createrington/shared/format";
import { renderScreenshot } from "@/discord/utils/render-screenshot";
import { playerAvatarUrl } from "@/services/skin-api/urls";
import {
  AttachmentBuilder,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("activity")
  .setDescription("View a player's activity heatmap")
  .addUserOption((opt) =>
    opt
      .setName("player")
      .setDescription("The player to view (defaults to you)")
      .setRequired(false),
  );

export const cooldown = {
  duration: 5,
  type: CooldownType.USER,
  message: "Please wait before viewing activity again!",
};

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const targetUser =
    interaction.options.getUser("player", false) || interaction.user;

  await interaction.deferReply();

  const details = await playerRepo
    .getDetailed({ discordId: targetUser.id })
    .catch(nullIfNotFound);
  if (!details) {
    await replyNotRegistered(interaction, targetUser);
    return;
  }
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
    const pt = formatPlaytime(details.playtime.totalSeconds);
    const sessions = details.playtime.totalSessions.toLocaleString();

    const embed = EmbedPresets.info(`${username}'s Activity`)
      .thumbnail(playerAvatarUrl(details.player.minecraftUuid))
      .field("Total Playtime", pt, true)
      .field("Sessions", sessions, true);

    await interaction.editReply({ embeds: [embed.build()] });
  }
}
