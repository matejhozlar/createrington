import { Q } from "@/db";
import { BalanceUtils } from "@/db/repositories/balance/utils";
import { EmbedPresets } from "@/discord/embeds";
import { replyError } from "@/discord/utils/interaction-reply";
import { CooldownType } from "@/discord/utils/cooldown";
import {
  type ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("money")
  .setDescription("Check your current balance");

export const cooldown = {
  duration: 5,
  type: CooldownType.USER,
  message: "Please wait before checking your balance again!",
};

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const discordId = interaction.user.id;

  try {
    const player = await Q.player.get({ discordId });
    const balance = await Q.player.balance.get({
      minecraftUuid: player.minecraftUuid,
    });

    const embed = EmbedPresets.plain({
      title: "💰 Your Balance",
      description: BalanceUtils.formatMoney(balance.balance),
    });

    await interaction.reply({
      embeds: [embed.build()],
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    logger.error("/money failed:", error);

    await replyError(
      interaction,
      "Balance Error",
      "Something went wrong while fetching your balance. Please try again.",
    );
  }
}
