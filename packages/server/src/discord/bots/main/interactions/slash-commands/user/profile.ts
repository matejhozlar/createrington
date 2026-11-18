import { playerRepo } from "@/db";
import { BalanceUtils } from "@/db/repositories/balance/utils";
import { EmbedPresets } from "@/discord/embeds";
import { replyError } from "@/discord/utils/interaction-reply";
import { CooldownType } from "@/discord/utils/cooldown";
import { formatPlaytime } from "@createrington/shared/format";
import { discordTimestamp } from "@/utils/format";
import { renderScreenshot } from "@/discord/utils/render-screenshot";
import { playerAvatarUrl } from "@/services/skin-api/urls";
import {
  AttachmentBuilder,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("profile")
  .setDescription("View a player's profile card")
  .addUserOption((opt) =>
    opt
      .setName("player")
      .setDescription("The player to view (defaults to you)")
      .setRequired(false),
  );

export const cooldown = {
  duration: 5,
  type: CooldownType.USER,
  message: "Please wait before viewing profiles again!",
};

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const targetUser =
    interaction.options.getUser("player", false) || interaction.user;

  await interaction.deferReply();

  try {
    const details = await playerRepo.getDetailed({ discordId: targetUser.id });
    const username = details.player.minecraftUsername;

    const screenshotBuffer = await renderScreenshot("profile", {
      player: targetUser.id,
    });

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
      const networth = BalanceUtils.formatMoney(details.balance?.balance ?? 0n);

      const pt = formatPlaytime(details.playtime.totalSeconds);
      const sessions = details.playtime.totalSessions.toLocaleString();
      const statusStr = details.player.online ? "🟢 Online" : "🔴 Offline";

      const embed = EmbedPresets.info(`${username}'s Profile`)
        .thumbnail(playerAvatarUrl(details.player.minecraftUuid))
        .field("Status", statusStr, true)
        .field("Networth", networth, true)
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
