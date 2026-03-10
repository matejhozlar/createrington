import { Q } from "@/db";
import { executeBuy, executeSell } from "@/services/crypto/trading/trade-executor";
import { EmbedPresets } from "@/discord/embeds";
import { EmbedColors } from "@/discord/embeds";
import { createEmbed } from "@/discord/embeds";
import { CooldownType } from "@/discord/utils/cooldown";
import {
  type ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";

/**
 * Slash command definition for the crypto command
 * Allows users to buy and sell crypto tokens using their balance
 */
export const data = new SlashCommandBuilder()
  .setName("crypto")
  .setDescription("Trade crypto tokens")
  .addSubcommand((sub) =>
    sub
      .setName("buy")
      .setDescription("Buy crypto tokens")
      .addStringOption((opt) =>
        opt
          .setName("symbol")
          .setDescription("Token symbol (e.g. FLF)")
          .setRequired(true),
      )
      .addIntegerOption((opt) =>
        opt
          .setName("amount")
          .setDescription("Number of tokens to buy")
          .setRequired(true)
          .setMinValue(1),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("sell")
      .setDescription("Sell crypto tokens")
      .addStringOption((opt) =>
        opt
          .setName("symbol")
          .setDescription("Token symbol (e.g. FLF)")
          .setRequired(true),
      )
      .addIntegerOption((opt) =>
        opt
          .setName("amount")
          .setDescription("Number of tokens to sell")
          .setRequired(true)
          .setMinValue(1),
      ),
  );

/**
 * Cooldown configuration for the crypto command
 *
 * - duration: 5 seconds
 * - type: "user" - Each user has their own cooldown
 * - message: Custom message shown when the user is on cooldown
 */
export const cooldown = {
  duration: 5,
  type: CooldownType.USER,
  message: "Please wait before trading again!",
};

/**
 * Executes the crypto command to buy or sell tokens
 *
 * Process:
 * 1. Verify the player is registered
 * 2. Validate the token symbol exists
 * 3. Execute the buy or sell trade via the trade executor
 * 4. Reply with trade confirmation including price, fee, and total
 *
 * @param interaction - The chat input command interaction
 */
export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();
  const symbol = interaction.options.getString("symbol", true).toUpperCase();
  const amount = interaction.options.getInteger("amount", true);
  const discordId = interaction.user.id;

  try {
    const playerEntry = await Q.player.find({ discordId });

    if (!playerEntry) {
      const embed = EmbedPresets.error(
        "Not Registered",
        "You must be registered to trade crypto. Use `/register` to get started.",
      );
      await interaction.reply({
        embeds: [embed.build()],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const token = await Q.crypto.token.find({ symbol });

    if (!token) {
      const embed = EmbedPresets.error(
        "Token Not Found",
        `No token with symbol **${symbol}** exists.`,
      );
      await interaction.reply({
        embeds: [embed.build()],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (subcommand === "buy") {
      const result = await executeBuy(
        playerEntry.minecraftUuid,
        token,
        BigInt(amount),
      );

      const embed = createEmbed()
        .title("Crypto Buy")
        .color(EmbedColors.Success)
        .description(
          `Bought **${Number(result.amount).toLocaleString()} ${result.symbol}**`,
        )
        .field("Price", `$${Number(result.priceAtExecution).toFixed(4)}`, true)
        .field("Fee", `$${result.feeAmount.toFixed(4)}`, true)
        .field("Total Cost", `$${result.totalCost.toFixed(2)}`, true)
        .timestamp();

      await interaction.reply({ embeds: [embed.build()] });
    } else {
      const result = await executeSell(
        playerEntry.minecraftUuid,
        token,
        BigInt(amount),
      );

      const embed = createEmbed()
        .title("Crypto Sell")
        .color(EmbedColors.Success)
        .description(
          `Sold **${Number(result.amount).toLocaleString()} ${result.symbol}**`,
        )
        .field("Price", `$${Number(result.priceAtExecution).toFixed(4)}`, true)
        .field("Fee", `$${result.feeAmount.toFixed(4)}`, true)
        .field("Revenue", `$${result.totalCost.toFixed(2)}`, true)
        .timestamp();

      await interaction.reply({ embeds: [embed.build()] });
    }
  } catch (error) {
    logger.error(`/crypto ${subcommand} failed:`, error);

    const message =
      error instanceof Error ? error.message : "Something went wrong.";
    const embed = EmbedPresets.error("Trade Failed", message);
    await interaction.reply({
      embeds: [embed.build()],
      flags: MessageFlags.Ephemeral,
    });
  }
}
