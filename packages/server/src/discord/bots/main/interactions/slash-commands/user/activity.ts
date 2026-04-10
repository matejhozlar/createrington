import { playerRepo } from "@/db";
import { EmbedPresets } from "@/discord/embeds";
import { CooldownType } from "@/discord/utils/cooldown";
import { formatPlaytime } from "@/utils/format";
import { getService, Services } from "@/services";
import config from "@/config";
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

    // Try to generate a visual heatmap via Puppeteer
    let screenshotBuffer: Buffer | null = null;
    try {
      const puppeteer = await getService(Services.PUPPETEER_SERVICE);
      const baseUrl =
        config.puppeteer.baseUrl ??
        (config.envMode.isDev
          ? "http://localhost:3000"
          : config.meta.links.website);

      const renderUrl = new URL("/render/activity", baseUrl);
      renderUrl.searchParams.set("secret", config.puppeteer.secret);
      renderUrl.searchParams.set("player", targetUser.id);

      const result = await puppeteer.screenshot({
        url: renderUrl.toString(),
        waitForSelector: "#activity-container",
        elementSelector: "#activity-container",
        settleDelay: 1500,
        timeout: 15_000,
        viewportWidth: 900,
        viewportHeight: 500,
      });

      screenshotBuffer = result.buffer;
    } catch (err) {
      logger.warn(
        "Puppeteer screenshot failed for /activity, falling back to text embed:",
        err,
      );
    }

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
    const embed = EmbedPresets.error(
      "Activity Error",
      "Could not fetch player data. They may not be registered.",
    );
    await interaction.editReply({ embeds: [embed.build()] });
  }
}
