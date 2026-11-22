import { Q } from "@/db";
import { BalanceUtils } from "@/db/utils/balance";
import { EmbedPresets } from "@/discord/embeds";
import { CooldownType } from "@/discord/utils/cooldown";
import { replyError } from "@/discord/utils/interaction-reply";
import {
  type ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import type {
  CommandCooldown,
  CommandModule,
} from "@/discord/bots/common/loaders/command-loader";

const data = new SlashCommandBuilder()
  .setName("money")
  .setDescription("Check your current balance");

const cooldown: CommandCooldown = {
  duration: 5,
  type: CooldownType.USER,
  message: "Please wait before checking your balance again!",
};

async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const discordId = interaction.user.id;

  const player = await Q.player.find({ discordId });
  if (!player) {
    await replyError(
      interaction,
      "Not Registered",
      "You must be registered to have a balance. Use `/register` to get started.",
    );
    return;
  }

  const balance = await Q.player.balance.find({
    minecraftUuid: player.minecraftUuid,
  });

  const embed = EmbedPresets.plain({
    title: "💰 Your Balance",
    description: BalanceUtils.formatMoney(balance?.balance ?? 0n),
  });

  await interaction.reply({
    embeds: [embed.build()],
    flags: MessageFlags.Ephemeral,
  });
}

export default {
  data,
  cooldown,
  execute,
} satisfies CommandModule;
