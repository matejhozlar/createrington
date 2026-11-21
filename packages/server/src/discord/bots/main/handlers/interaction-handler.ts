import type {
  ButtonInteraction,
  ChatInputCommandInteraction,
  Client,
  Collection,
  Interaction,
  ModalSubmitInteraction,
  RepliableInteraction,
} from "discord.js";
import { MessageFlags } from "discord.js";
import { cooldownManager } from "@/discord/utils/cooldown";
import { EmbedPresets } from "@/discord/embeds";
import { InteractionError } from "@/discord/utils/interaction-error";
import { Q } from "@/db";

import { requireAdmin, requireOwner } from "@/discord/utils/admin-guard";
import type { CommandModule } from "../../common/loaders/command-loader";
import {
  type ButtonModule,
  findComponentHandler,
  type ModalModule,
} from "../../common/loaders/component-loader";

export interface InteractionHandlers {
  commands: Collection<string, CommandModule>;
  buttons: readonly ButtonModule[];
  modals: readonly ModalModule[];
}

const FAILURE_TITLE = "Something Went Wrong";
const FAILURE_DESCRIPTION =
  "Please try again in a moment, and contact staff if it keeps happening.";

async function reportFailure(
  interaction: RepliableInteraction,
  label: string,
  error: unknown,
): Promise<void> {
  const specific = error instanceof InteractionError ? error : null;
  logger.error(`${label} failed:`, specific?.cause ?? error);

  const message = {
    embeds: [
      EmbedPresets.error(
        specific?.title ?? FAILURE_TITLE,
        specific?.description ?? FAILURE_DESCRIPTION,
      ).build(),
    ],
    flags: MessageFlags.Ephemeral,
  } as const;

  try {
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(message);
    } else {
      await interaction.reply(message);
    }
  } catch (replyFailure) {
    logger.error(`Could not report that ${label} failed:`, replyFailure);
  }
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
    await reportFailure(interaction, `/${interaction.commandName}`, error);
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
  buttonHandlers: readonly ButtonModule[],
): Promise<void> {
  const handler = findComponentHandler(interaction.customId, buttonHandlers);

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
      await reportFailure(
        interaction,
        `Permission check for button ${interaction.customId}`,
        error,
      );
      return;
    }
  }

  try {
    await handler.execute(interaction);
  } catch (error) {
    await reportFailure(interaction, `Button ${interaction.customId}`, error);
  }
}

export function registerInteractionHandler(
  discordClient: Client,
  handlers: InteractionHandlers,
): void {
  discordClient.on("interactionCreate", (interaction: Interaction) => {
    routeInteraction(interaction, handlers).catch((error: unknown) => {
      logger.error("Unhandled error while routing an interaction:", error);
    });
  });
}

async function routeInteraction(
  interaction: Interaction,
  handlers: InteractionHandlers,
): Promise<void> {
  if (interaction.isChatInputCommand()) {
    await handleChatCommands(interaction, handlers.commands);
    return;
  }

  if (interaction.isAutocomplete()) {
    const command = handlers.commands.get(interaction.commandName);
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
    await handleButtonInteractions(interaction, handlers.buttons);
    return;
  }

  if (interaction.isModalSubmit()) {
    await handleModalSubmit(interaction, handlers.modals);
    return;
  }
}

async function handleModalSubmit(
  interaction: ModalSubmitInteraction,
  modalHandlers: readonly ModalModule[],
): Promise<void> {
  const handler = findComponentHandler(interaction.customId, modalHandlers);

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
    await reportFailure(interaction, `Modal ${interaction.customId}`, error);
  }
}
