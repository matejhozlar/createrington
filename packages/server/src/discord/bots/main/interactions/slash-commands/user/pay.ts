import { balanceRepo, player } from "@/db";
import { BalanceUtils } from "@/db/repositories/balance/utils";
import { EmbedPresets } from "@/discord/embeds";
import { CooldownType } from "@/discord/utils/cooldown";
import { formatBalance } from "@/utils/format";
import {
  type ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";

/**
 * Slash command definition for the pay command
 * Allows users to transfer money to other registered users
 */
export const data = new SlashCommandBuilder()
  .setName("pay")
  .setDescription("Send money to another player")
  .addUserOption((option) =>
    option
      .setName("recipient")
      .setDescription("The player to send money to")
      .setRequired(true),
  )
  .addNumberOption((option) =>
    option
      .setName("amount")
      .setDescription("Amount to send (e.g., 10)")
      .setRequired(true)
      .setMinValue(0.001),
  )
  .addStringOption((option) =>
    option
      .setName("note")
      .setDescription("Optional note for the transfer")
      .setRequired(false)
      .setMaxLength(200),
  );

/**
 * Cooldown configuration for the pay command
 *
 * - duration: 3 seconds
 * - type: "user" - Each user has their own cooldown
 * - message: Custom message shown when the user is on cooldown
 */
export const cooldown = {
  duration: 3,
  type: CooldownType.USER,
  message: "Please wait before sending money again!",
};

/**
 * Whether this command should only be available in production
 * Set to false to allow usage in development
 */

/**
 * Executes the pay command to transfer money between users
 *
 * Process:
 * 1. Extract the sender's Discord user ID from the interaction
 * 2. Extract the recipient user and amount from command options
 * 3. Validate that sender and recipient are different users
 * 4. Validate that both users are registered in the system
 * 5. Validate the amount (positive, max 3 decimals)
 * 6. Check if sender has sufficient balance
 * 7. Execute the transfer using the balance repository
 * 8. Display success message with transaction details
 * 9. Handle and report any errors that occur during the process
 *
 * @param interaction - The chat input command interaction
 * @returns Promise resolving when the command execution is completed
 */
export async function execute(interaction: ChatInputCommandInteraction) {
  const sender = interaction.user;
  const recipient = interaction.options.getUser("recipient", true);
  const amount = interaction.options.getNumber("amount", true);
  const note = interaction.options.getString("note") || undefined;

  if (sender.id === recipient.id) {
    const embed = EmbedPresets.error(
      "Invalid Transfer",
      "You cannot send money to yourself.",
    );

    await interaction.reply({
      embeds: [embed.build()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (recipient.bot) {
    const embed = EmbedPresets.error(
      "Invalid Transfer",
      "You cannot send money to bots.",
    );

    await interaction.reply({
      embeds: [embed.build()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    try {
      BalanceUtils.validate(amount);
    } catch (error) {
      const embed = EmbedPresets.error(
        "Invalid Amount",
        error instanceof Error
          ? error.message
          : "Amount must have at most 3 decimals!",
      );
      return;
    }

    const senderPlayer = await player.find({ discordId: sender.id });

    if (!senderPlayer) {
      const embed = EmbedPresets.error(
        "Not Registered",
        "You must be registered to send money. Use `/register` to get started.",
      );

      await interaction.reply({
        embeds: [embed.build()],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const recipientPlayer = await player.find({ discordId: recipient.id });

    if (!recipientPlayer) {
      const embed = EmbedPresets.error(
        "Recipient Not Registered",
        `${recipient.tag} is not registered in the system.`,
      );

      await interaction.reply({
        embeds: [embed.build()],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const hasSufficient = await balanceRepo.hasSufficient(senderPlayer, amount);

    if (!hasSufficient) {
      const senderBalance = await balanceRepo.getAmount(senderPlayer);

      const embed = EmbedPresets.error(
        "Insufficient Balance",
        `You don't have enough money to complete this transfer.\n\n` +
          `**Your Balance:** $${BalanceUtils.format(BalanceUtils.toStorage(senderBalance))}\n` +
          `**Required:** $${BalanceUtils.format(BalanceUtils.toStorage(amount))}`,
      );

      await interaction.reply({
        embeds: [embed.build()],
        flags: MessageFlags.Ephemeral,
      });
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
      `You sent **${formatBalance(BalanceUtils.format(BalanceUtils.toStorage(amount)))}** to ${recipient.tag}`,
    ).field(
      "Your New Balance",
      `${formatBalance(BalanceUtils.format(BalanceUtils.toStorage(result.senderBalance)))}`,
      true,
    );

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
  } catch (error) {
    logger.error("/pay failed:", error);

    const embed = EmbedPresets.error(
      "Transfer Failed",
      error instanceof Error
        ? error.message
        : "Something went wrong while processing the transfer.",
    );

    await interaction.reply({
      embeds: [embed.build()],
      flags: MessageFlags.Ephemeral,
    });
  }
}
