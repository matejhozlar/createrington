import type {
  ButtonInteraction,
  ChatInputCommandInteraction,
  Client,
  Collection,
  Interaction,
  ModalSubmitInteraction,
} from "discord.js";
import { MessageFlags } from "discord.js";
import { cooldownManager } from "@/discord/utils/cooldown";
import { EmbedPresets } from "@/discord/embeds";
import { Q } from "@/db";

import { requireAdmin, requireOwner } from "@/discord/utils/admin-guard";
import type { CommandModule } from "../../common/loaders/command-loader";
import {
  type ButtonModule,
  findButtonHandler,
} from "../../common/loaders/button-loader";
import * as registrationModal from "../interactions/modals/registration";
import * as promptSubmitModal from "../interactions/modals/prompt-submit";
import * as workshopSuggestModal from "../interactions/modals/workshop-suggest";

type ModalHandler = {
  customId: string;
  execute: (interaction: ModalSubmitInteraction) => Promise<void>;
};

const MODAL_HANDLERS: ModalHandler[] = [
  registrationModal,
  promptSubmitModal,
  workshopSuggestModal,
];

function modalHandlerMatches(handler: ModalHandler, customId: string): boolean {
  if (handler.customId.endsWith(":*")) {
    const prefix = handler.customId.slice(0, -1);
    return customId.startsWith(prefix);
  }
  return handler.customId === customId;
}

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

async function checkPermission(
  interaction: ChatInputCommandInteraction,
  command: CommandModule,
): Promise<boolean> {
  if (command.permissions?.requireOwner) return requireOwner(interaction);
  if (command.permissions?.requireAdmin) return requireAdmin(interaction);
  return true;
}

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

  if (command.cooldown) {
    const cooldownRemaining = cooldownManager.check(
      interaction.commandName,
      interaction.user.id,
    );

    if (cooldownRemaining !== null) {
      const expiresAt = cooldownManager.getExpiry(
        interaction.commandName,
        interaction.user.id,
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

    cooldownManager.set(
      interaction.commandName,
      interaction.user.id,
      command.cooldown.duration,
    );
  }

  let success = true;
  try {
    await command.execute(interaction);
  } catch (error) {
    success = false;
    logger.error(`Error executing command ${interaction.commandName}:`, error);

    try {
      const replyMethod =
        interaction.replied || interaction.deferred
          ? interaction.followUp
          : interaction.reply;

      await replyMethod.call(interaction, {
        content: "❌ Command failed",
        flags: MessageFlags.Ephemeral,
      });
    } catch (replyError) {
      logger.error("Failed to send command error response:", error, replyError);
    }
  }

  Q.discord.command.usage
    .create({
      commandName: interaction.commandName,
      discordId: interaction.user.id,
      success,
    })
    .catch((err) => logger.error("Failed to log command usage:", err));
}

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
      logger.error("Failed to send error response:", error, replyError);
    }
  }
}

export function registerInteractionHandler(
  discordClient: Client,
  commandHandlers: Collection<string, CommandModule>,
  buttonHandlers: Collection<string, ButtonModule>,
): void {
  discordClient.on("interactionCreate", (interaction: Interaction) => {
    routeInteraction(interaction, commandHandlers, buttonHandlers).catch(
      (error: unknown) => {
        logger.error("Unhandled error while routing an interaction:", error);
      },
    );
  });
}

async function routeInteraction(
  interaction: Interaction,
  commandHandlers: Collection<string, CommandModule>,
  buttonHandlers: Collection<string, ButtonModule>,
): Promise<void> {
  if (interaction.isChatInputCommand()) {
    await handleChatCommands(interaction, commandHandlers);
    return;
  }

  if (interaction.isAutocomplete()) {
    const command = commandHandlers.get(interaction.commandName);
    if (command?.autocomplete) {
      try {
        await command.autocomplete(interaction);
      } catch (error) {
        logger.error(
          `Autocomplete error for /${interaction.commandName}:`,
          error,
        );
      }
    }
    return;
  }

  if (interaction.isButton()) {
    await handleButtonInteractions(interaction, buttonHandlers);
    return;
  }

  if (interaction.isModalSubmit()) {
    await handleModalSubmit(interaction);
    return;
  }
}

async function handleModalSubmit(
  interaction: ModalSubmitInteraction,
): Promise<void> {
  const handler = MODAL_HANDLERS.find((h) =>
    modalHandlerMatches(h, interaction.customId),
  );

  if (!handler) {
    logger.debug(`No handler for modal: ${interaction.customId}`);
    return;
  }

  logger.info(
    `${interaction.user.tag} (${interaction.user.id}) submitted modal: ${interaction.customId}`,
  );

  try {
    await handler.execute(interaction);
  } catch (error) {
    logger.error(
      `Error executing modal handler ${interaction.customId}:`,
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
      logger.error("Failed to send modal error response:", error, replyError);
    }
  }
}
