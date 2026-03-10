import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  PermissionFlagsBits,
  MessageFlags,
} from "discord.js";
import { EmbedPresets } from "@/discord/embeds";
import { cooldownManager } from "@/discord/utils/cooldown/cooldown-manager";

/**
 * Slash command definition for the cooldown management command
 *
 * Allows administrators to manage command cooldowns with three subcommands:
 * - reset: Reset all cooldowns for a specific user
 * - reset-command: Reset all cooldowns for a specific command
 * - stats: View statistics about active cooldowns
 *
 * Requires Administrator permissions to use
 */
export const data = new SlashCommandBuilder()
  .setName("cooldown")
  .setDescription("Manage command cooldowns")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand((sub) =>
    sub
      .setName("reset")
      .setDescription("Reset cooldown for a user")
      .addUserOption((opt) =>
        opt
          .setName("user")
          .setDescription("User to reset cooldowns for")
          .setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("reset-command")
      .setDescription("Reset all cooldowns for a specific command")
      .addStringOption((opt) =>
        opt
          .setName("command")
          .setDescription("Command name to reset")
          .setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub.setName("stats").setDescription("View cooldown statistics"),
  );

/**
 * Executes the cooldown management command
 *
 * Handles three subcommands:
 * 1. reset - Resets all cooldowns for a specific user and displays the count
 * 2. reset-command - Resets all cooldowns for a specific command
 * 3. stats - Displays statistics about active cooldowns including:
 *    - Total number of active cooldowns
 *    - Number of commands with cooldowns
 *    - Breakdown by command name
 *
 * @param interaction - The chat input command interaction
 * @returns Promise that resolves when the command execution is complete
 *
 * @example
 * // User runs: /cooldown reset @user
 * // Bot responds: "Reset 3 cooldown(s) for username#1234"
 *
 * @example
 * // User runs: /cooldown stats
 * // Bot displays embed with cooldown statistics
 */
export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case "reset": {
      const user = interaction.options.getUser("user", true);
      const count = cooldownManager.resetUser(user.id);

      const embed = EmbedPresets.success(
        "Cooldowns Reset",
        `Reset ${count} cooldown(s) for ${user.tag}`,
      ).build();

      await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
      });
      break;
    }

    case "reset-command": {
      const commandName = interaction.options.getString("command", true);
      const success = cooldownManager.resetCommand(commandName);

      const embed = success
        ? EmbedPresets.success(
            "Command Cooldowns Reset",
            `All cooldowns for \`/${commandName}\` have been reset.`,
          )
        : EmbedPresets.error(
            "No Cooldowns Found",
            `No active cooldowns found for \`/${commandName}\``,
          );

      await interaction.reply({
        embeds: [embed.build()],
        flags: MessageFlags.Ephemeral,
      });
      break;
    }

    case "stats": {
      const stats = cooldownManager.getStats();

      const embed = EmbedPresets.commands.cooldownStats(stats);

      await interaction.reply({
        embeds: [embed.build()],
        flags: MessageFlags.Ephemeral,
      });
      break;
    }
  }
}
