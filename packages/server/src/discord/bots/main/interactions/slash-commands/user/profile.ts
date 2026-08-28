import { playerRepo } from "@/db";
import { BalanceUtils } from "@/db/repositories/balance/utils";
import { EmbedPresets } from "@/discord/embeds";
import { replyError } from "@/discord/utils/interaction-reply";
import { CooldownType } from "@/discord/utils/cooldown";
import { discordTimestamp, formatPlaytime } from "@/utils/format";
import { getService, Services } from "@/services";
import config from "@/config";
import {
  AttachmentBuilder,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";

/**
 * Slash command definition for the profile command
 * Displays a Minecraft-themed player profile card with 3D skin
 */
export const data = new SlashCommandBuilder()
  .setName("profile")
  .setDescription("View a player's profile card")
  .addUserOption((opt) =>
    opt
      .setName("player")
      .setDescription("The player to view (defaults to you)")
      .setRequired(false),
  );

/**
 * Cooldown configuration for the profile command
 *
 * - duration: 5 seconds
 * - type: "user" - Each user has their own cooldown
 * - message: Custom message shown when the user is on cooldown
 */
export const cooldown = {
  duration: 5,
  type: CooldownType.USER,
  message: "Please wait before viewing profiles again!",
};

/**
 * Executes the profile command to generate a player profile card
 *
 * Process:
 * 1. Get the target user (defaults to command initiator)
 * 2. Screenshot the profile render page via PuppeteerService
 * 3. Reply with the screenshot embedded in an embed, with text fallback
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

    // Try to generate a visual profile card via Puppeteer
    let screenshotBuffer: Buffer | null = null;
    try {
      const puppeteer = await getService(Services.PUPPETEER_SERVICE);
      const renderUrl = new URL("/render/profile", config.puppeteer.baseUrl);
      renderUrl.searchParams.set("player", targetUser.id);

      const result = await puppeteer.screenshot({
        url: renderUrl.toString(),
        extraHeaders: { "x-render-secret": config.puppeteer.secret },
        waitForSelector: "#profile-container",
        elementSelector: "#profile-container",
        timeout: 15_000,
        viewportWidth: 900,
        viewportHeight: 500,
      });

      screenshotBuffer = result.buffer;
    } catch (error) {
      logger.warn(
        "Puppeteer screenshot failed for /profile, falling back to text embed:",
        error,
      );
    }

    if (screenshotBuffer) {
      const attachment = new AttachmentBuilder(screenshotBuffer, {
        name: `profile_${username}.png`,
      });

      const embed = EmbedPresets.info(`${username}'s Profile`).image(
        `attachment://profile_${username}.png`,
      );

      await interaction.editReply({
        embeds: [embed.build()],
        files: [attachment],
      });
    } else {
      // Text fallback if Puppeteer is unavailable
      const networth = details.balance
        ? BalanceUtils.fromStorage(details.balance.balance)
        : 0;
      const networthStr = networth.toFixed(3).replace(/\.?0+$/, "") || "0";

      const pt = formatPlaytime(details.playtime.totalSeconds);
      const sessions = details.playtime.totalSessions.toLocaleString();
      const statusStr = details.player.online ? "🟢 Online" : "🔴 Offline";

      const embed = EmbedPresets.info(`${username}'s Profile`)
        .thumbnail(
          `https://mc-heads.net/avatar/${details.player.minecraftUuid}`,
        )
        .field("Status", statusStr, true)
        .field("Networth", `$${networthStr}`, true)
        .field("\u200b", "\u200b")
        .field("Playtime", pt, true)
        .field("Sessions", sessions, true)
        .field(
          "Member Since",
          discordTimestamp(details.player.createdAt, "D"),
          false,
        );

      await interaction.editReply({ embeds: [embed.build()] });
    }
  } catch {
    await replyError(
      interaction,
      "Profile Error",
      "Could not fetch player data. They may not be registered.",
    );
  }
}
