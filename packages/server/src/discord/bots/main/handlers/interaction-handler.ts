import type {
  ButtonInteraction,
  ChatInputCommandInteraction,
  Client,
  Collection,
  Interaction,
} from "discord.js";
import { MessageFlags } from "discord.js";
import { cooldownManager } from "@/discord/utils/cooldown";
import { EmbedPresets } from "@/discord/embeds";

import { requireAdmin } from "@/discord/utils/admin-guard";
import type { CommandModule } from "../../common/loaders/command-loader";
import {
  type ButtonModule,
  findButtonHandler,
} from "../../common/loaders/button-loader";

// ==========================================================================
// HELPERS
// ==========================================================================

/**
 * Formats a cooldown duration in seconds into a human-readable string
 *
 * @param seconds - The cooldown duration in seconds
 * @returns Formatted string (e.g., "5.0 second(s)", "2 minute(s) and 30 second(s)", "1 hour(s)")
 */
function formatCooldown(seconds: number): string {
  if (seconds < 60) {
    return `${seconds.toFixed(1)} second(s)`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  if (minutes < 60) {
    return remainingSeconds > 0
      ? `${minutes} minute(s) and ${remainingSeconds} second(s)`
      : `${minutes} minute(s)`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes > 0
    ? `${hours} hour(s) and ${remainingMinutes} minute(s)`
    : `${hours} hour(s)`;
}

/**
 * Checks if a usr can bypass the cooldown for a command
 *
 * Users can bypass cooldowns if:
 * - The command has no cooldown configured
 * - Their user ID is in the command's bypassUsers list
 * - They have a role that's in the command's bypassRoles list
 *
 * @param interaction - The chat input interaction
 * @param command - The command module being executed
 * @returns True if the user can bypass the cooldown, false otherwise
 */
function canBypassCooldown(
  interaction: ChatInputCommandInteraction,
  command: CommandModule,
): boolean {
  if (!command.cooldown) return true;

  if (command.cooldown.bypassUsers?.includes(interaction.user.id)) {
    return true;
  }

  if (interaction.guild && command.cooldown.bypassRoles) {
    const member = interaction.member;
    if (member && "roles" in member) {
      const memberRoles = member.roles as { cache: Collection<string, any> };
      const hasRole = command.cooldown.bypassRoles.some((roleId) =>
        memberRoles.cache.has(roleId),
      );
      if (hasRole) return true;
    }
  }

  return false;
}

/**
 * Checks command permissions before execution
 *
 * @param interaction - The chat input interaction
 * @param command - The command module being executed
 * @returns True if the user has permission, false otherwise (and sends error message)
 */
async function checkPermission(
  interaction: ChatInputCommandInteraction,
  command: CommandModule,
): Promise<boolean> {
  if (!command.permissions) return true;

  if (command.permissions.requireAdmin) {
    const hasPermission = await requireAdmin(interaction);
    if (!hasPermission) {
      return false;
    }
  }

  if (command.permissions.customCheck) {
    try {
      const hasPermission = await command.permissions.customCheck(interaction);
      if (!hasPermission) {
        return false;
      }
    } catch (error) {
      logger.error(
        `Error in custom permission check for ${interaction.commandName}`,
        error,
      );

      const embed = EmbedPresets.error(
        "Permission Check Failed",
        "An error ocurred while checking permissions",
      );

      await interaction.reply({
        embeds: [embed.build()],
        flags: MessageFlags.Ephemeral,
      });

      return false;
    }
  }

  return true;
}

// ==========================================================================
// HANDLERS
// ==========================================================================

/**
 * Handles execution of slash commands with cooldown management
 *
 * Process:
 * 1. Retrieves the command handler
 * 2. Checks permissions (admin, custom checks)
 * 3. Checks if the command is on cooldown (unless user can bypass)
 * 4. Executes the command if not on cooldown
 * 5. Sets cooldown after successful execution
 * 6. Handles errors with ephemeral error messages
 *
 * @param interaction - The chat input command interaction
 * @param commandHandlers - Collection of registered command handlers
 * @returns Promise resolving when the command handling is completed
 */
async function handleChatCommands(
  interaction: ChatInputCommandInteraction,
  commandHandlers: Collection<string, CommandModule>,
): Promise<void> {
  const command = commandHandlers.get(interaction.commandName);

  if (!command) {
    logger.warn(`Unknown command received /${interaction.commandName}`);
    return;
  }

  logger.info(
    `${interaction.user.tag} (${interaction.user.id}) ran /${interaction.commandName}`,
  );

  const hasPermission = await checkPermission(interaction, command);
  if (!hasPermission) {
    logger.debug(
      `${interaction.user.tag} denied permission for /${interaction.commandName}`,
    );
    return;
  }

  if (command.cooldown && !canBypassCooldown(interaction, command)) {
    const cooldownRemaining = cooldownManager.check(
      interaction.commandName,
      command.cooldown,
      {
        userId: interaction.user.id,
        channelId: interaction.channelId,
        guildId: interaction.guildId,
      },
    );

    if (cooldownRemaining !== null) {
      const expiresAt = cooldownManager.getExpiry(
        interaction.commandName,
        command.cooldown.type,
        {
          userId: interaction.user.id,
          channelId: interaction.channelId,
          guildId: interaction.guildId,
        },
      );

      const unixExpiresAt = expiresAt ? Math.floor(expiresAt / 1000) : null;

      const cooldownMessage =
        command.cooldown.message ||
        "This command is on cooldown. Please wait before trying to use it again!";

      const cooldownEmbed = EmbedPresets.error(
        "Command on Cooldown",
        cooldownMessage,
      )
        .field(
          "Time remaining",
          unixExpiresAt
            ? `<t:${unixExpiresAt}:R>`
            : formatCooldown(cooldownRemaining),
          true,
        )
        .noTimestamp()
        .build();

      await interaction.reply({
        embeds: [cooldownEmbed],
        flags: MessageFlags.Ephemeral,
      });

      logger.debug(
        `${interaction.user.tag} tried to use /${
          interaction.commandName
        } but it's on cooldown (${cooldownRemaining.toFixed(1)}s remaning)`,
      );
      return;
    }
  }

  try {
    await command.execute(interaction);

    if (command.cooldown && !canBypassCooldown(interaction, command)) {
      cooldownManager.set(interaction.commandName, command.cooldown, {
        userId: interaction.user.id,
        channelId: interaction.channelId,
        guildId: interaction.guildId,
      });
    }
  } catch (error) {
    logger.error(`Error executing command ${interaction.commandName}:`, error);

    const replyMethod =
      interaction.replied || interaction.deferred
        ? interaction.followUp
        : interaction.reply;

    await replyMethod.call(interaction, {
      content: "❌ Command failed",
      flags: MessageFlags.Ephemeral,
    });
  }
}

/**
 * Handles button interactions
 *
 * Process:
 * 1. Finds matching button handler based on customId pattern
 * 2. Checks permissions if handler has permission check
 * 3. Executes the button handler
 * 4. Handles errors with ephemeral error messages
 *
 * @param interaction - The button interaction
 * @param buttonHandlers - Collection of registered button handlers
 * @returns Promise resolving when the button handling is completed
 */
async function handleButtonInteractions(
  interaction: ButtonInteraction,
  buttonHandlers: Collection<string, ButtonModule>,
): Promise<void> {
  const handler = findButtonHandler(interaction.customId, buttonHandlers);

  if (!handler) {
    logger.debug(`No handler found for button: ${interaction.customId}`);
    return;
  }

  logger.info(
    `${interaction.user.tag} (${interaction.user.id}) clicked button: ${interaction.customId}`,
  );

  if (handler.checkPermission) {
    try {
      const hasPermission = await handler.checkPermission(interaction);

      if (!hasPermission) {
        const message =
          handler.permissionDeniedMessage ||
          "You don't have permission to use this button.";

        await interaction.reply({
          content: message,
          flags: MessageFlags.Ephemeral,
        });

        logger.debug(
          `${interaction.user.tag} denied access to button: ${interaction.customId}`,
        );
        return;
      }
    } catch (error) {
      logger.error(
        `Error checking permissions for button ${interaction.customId}:`,
        error,
      );

      await interaction.reply({
        content: "❌ Error checking permissions",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
  }

  try {
    await handler.execute(interaction);
  } catch (error) {
    logger.error(
      `Error executing button handler ${interaction.customId}:`,
      error,
    );

    try {
      const replyMethod =
        interaction.replied || interaction.deferred
          ? interaction.followUp
          : interaction.reply;

      await replyMethod.call(interaction, {
        content: "❌ Something went wrong",
        flags: MessageFlags.Ephemeral,
      });
    } catch (replyError) {
      logger.error("Failed to send error response:", error);
    }
  }
}

// ==========================================================================
// SETUP
// ==========================================================================

/**
 * Registers the interaction event handler for the Discord client
 *
 * Sets up a listener for the 'interactionCreate' event that routes
 * chat input commands and button interactions to appropriate handlers
 *
 * @param discordClient - The Discord client instance
 * @param commandHandlers - Collection of slash command handlers keyed by command name
 * @param buttonHandlers - Collection of button handlers with pattern matching
 */
export function registerInteractionHandler(
  discordClient: Client,
  commandHandlers: Collection<string, CommandModule>,
  buttonHandlers: Collection<string, ButtonModule>,
): void {
  discordClient.on("interactionCreate", async (interaction: Interaction) => {
    if (interaction.isChatInputCommand()) {
      await handleChatCommands(interaction, commandHandlers);
      return;
    }

    if (interaction.isButton()) {
      await handleButtonInteractions(interaction, buttonHandlers);
      return;
    }
  });
}
