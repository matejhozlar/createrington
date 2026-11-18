import { Q, balanceRepo } from "@/db";
import { EmbedPresets } from "@/discord/embeds";
import { replyError } from "@/discord/utils/interaction-reply";
import { CooldownType } from "@/discord/utils/cooldown";
import { formatMoney } from "@createrington/shared/format";
import {
  type ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("pay")
  .setDescription("Send money to another player")
  .addUserOption((option) =>
    option
      .setName("recipient")
      .setDescription("The player to send money to")
      .setRequired(true),
  )
  .addIntegerOption((option) =>
    option
      .setName("amount")
      .setDescription("Whole dollars to send (e.g., 10)")
      .setRequired(true)
      .setMinValue(1),
  )
  .addStringOption((option) =>
    option
      .setName("note")
      .setDescription("Optional note for the transfer")
      .setRequired(false)
      .setMaxLength(200),
  );

export const cooldown = {
  duration: 3,
  type: CooldownType.USER,
  message: "Please wait before sending money again!",
};

export async function execute(interaction: ChatInputCommandInteraction) {
  const sender = interaction.user;
  const recipient = interaction.options.getUser("recipient", true);
  const amount = interaction.options.getInteger("amount", true);
  const note = interaction.options.getString("note") || undefined;

  if (sender.id === recipient.id) {
    await replyError(
      interaction,
      "Invalid Transfer",
      "You cannot send money to yourself.",
    );
    return;
  }

  if (recipient.bot) {
    await replyError(
      interaction,
      "Invalid Transfer",
      "You cannot send money to bots.",
    );
    return;
  }

  const senderPlayer = await Q.player.find({ discordId: sender.id });

  if (!senderPlayer) {
    await replyError(
      interaction,
      "Not Registered",
      "You must be registered to send money. Use `/register` to get started.",
    );
    return;
  }

  const recipientPlayer = await Q.player.find({ discordId: recipient.id });

  if (!recipientPlayer) {
    await replyError(
      interaction,
      "Recipient Not Registered",
      `${recipient.tag} is not registered in the system.`,
    );
    return;
  }

  const hasSufficient = await balanceRepo.hasSufficient(senderPlayer, amount);

  if (!hasSufficient) {
    const senderBalance = await balanceRepo.getAmount(senderPlayer);

    await replyError(
      interaction,
      "Insufficient Balance",
      `You don't have enough money to complete this transfer.\n\n` +
        `**Your Balance:** ${formatMoney(senderBalance)}\n` +
        `**Required:** ${formatMoney(amount)}`,
    );
    return;
  }

  const result = await balanceRepo.transfer(
    senderPlayer,
    recipientPlayer,
    amount,
    note,
  );

  const embed = EmbedPresets.success(
    "Transfer Complete",
    `You sent **${formatMoney(amount)}** to ${recipient.tag}`,
  ).field("Your New Balance", formatMoney(result.senderBalance), true);

  if (note) {
    embed.field("Note", note, false);
  }

  await interaction.reply({
    embeds: [embed.build()],
    flags: MessageFlags.Ephemeral,
  });

  logger.info(
    `User ${sender.tag} (${sender.id}) sent $${amount} to ${recipient.tag} (${recipient.id})${note ? ` - Note: ${note}` : ""}`,
  );
}
