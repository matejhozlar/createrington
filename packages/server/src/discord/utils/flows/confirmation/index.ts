import {
  type ButtonInteraction,
  type ButtonStyle,
  type ChatInputCommandInteraction,
  MessageFlags,
  ButtonBuilder,
  ActionRowBuilder,
  ComponentType,
} from "discord.js";
import type { DiscordEmbedBuilder } from "@/discord/embeds/embed-builder";
import { EmbedPresets } from "@/discord/embeds";

export interface ConfirmationButton {
  /** Button label */
  label: string;
  /** Button style */
  style: ButtonStyle;
  /** Emoji (optional) */
  emoji?: string;
  /** Custom ID suffix (auto-prefixed with flow ID) */
  customId: string;
  /** Handler function when clicked */
  handler: (interaction: ButtonInteraction) => Promise<void>;
}

export interface ConfirmationFlowOptions {
  /** The embed to display */
  embed: DiscordEmbedBuilder;
  /** Buttons to show */
  buttons: ConfirmationButton[];
  /** Timeout in milliseconds (default: 5 minutes) */
  timeout?: number;
  /** Whether to make the reply ephemeral (default: true) */
  ephemeral?: boolean;
  /** Callback when timeout occurs */
  onTimeout?: () => Promise<void>;
  /** Only allow the command author to interact (default: true) */
  authorOnly?: boolean;
  /** Whether the interaction has already been deferred (default: false) */
  isDeferred?: boolean;
}

/**
 * Manages ephemeral confirmation dialogs with button interactions
 *
 * - Displays an embed with configurable action buttons
 * - Supports author-only interaction filtering and auto-timeout
 * - Tracks active flows for graceful shutdown cleanup
 */
export class ConfirmationFlow {
  private static activeFlows = new Map<string, NodeJS.Timeout>();

  /**
   * Creates a confirmation flow with buttons
   *
   * @param interaction - The initial command interaction
   * @param options - Confirmation flow configuration
   */
  static async create(
    interaction: ChatInputCommandInteraction,
    options: ConfirmationFlowOptions,
  ): Promise<void> {
    const {
      embed,
      buttons,
      timeout = 5 * 60 * 1000,
      ephemeral = true,
      onTimeout,
      authorOnly = true,
      isDeferred = false,
    } = options;

    const flowId = `${interaction.id}-${Date.now()}`;

    const buttonComponents = buttons.map((btn) =>
      new ButtonBuilder()
        .setCustomId(`${flowId}:${btn.customId}`)
        .setLabel(btn.label)
        .setStyle(btn.style)
        .setEmoji(btn.emoji || ""),
    );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      buttonComponents,
    );

    const message = isDeferred
      ? await interaction.editReply({
          embeds: [embed.build()],
          components: [row],
        })
      : await interaction.reply({
          embeds: [embed.build()],
          components: [row],
          flags: ephemeral ? MessageFlags.Ephemeral : undefined,
          fetchReply: true,
        });

    const handlerMap = new Map<string, ConfirmationButton["handler"]>();
    buttons.forEach((btn) => {
      handlerMap.set(`${flowId}:${btn.customId}`, btn.handler);
    });

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: timeout,
    });

    collector.on("collect", async (buttonInteraction: ButtonInteraction) => {
      if (authorOnly && buttonInteraction.user.id !== interaction.user.id) {
        await buttonInteraction.reply({
          content: "❌ Only the command author can use these buttons",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const handler = handlerMap.get(buttonInteraction.customId);
      if (!handler) {
        await buttonInteraction.reply({
          content: "❌ Unknown action",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      try {
        await handler(buttonInteraction);

        collector.stop("handled");
        this.clearTimeout(flowId);
      } catch (error) {
        logger.error("Confirmation handler error:", error);

        if (!buttonInteraction.replied && !buttonInteraction.deferred) {
          await buttonInteraction.reply({
            content: "❌ An error occurred",
            flags: MessageFlags.Ephemeral,
          });
        }
      }
    });

    collector.on("end", async (collected, reason) => {
      if (reason === "time") {
        try {
          const disableRow =
            new ActionRowBuilder<ButtonBuilder>().addComponents(
              buttonComponents.map((btn) =>
                ButtonBuilder.from(btn).setDisabled(true),
              ),
            );

          const timeoutEmbed = EmbedPresets.error(
            "Confirmation Expired",
            "This confirmation has timed out. Please run the command again",
          );

          await interaction.editReply({
            embeds: [timeoutEmbed.build()],
            components: [disableRow],
          });

          if (onTimeout) {
            await onTimeout();
          }

          logger.debug(`Confirmation flow ${flowId} timed out`);
        } catch (error) {
          logger.error("Error handling confirmation timeout:", error);
        }
      }

      this.clearTimeout(flowId);
    });

    const timeoutId = setTimeout(() => {
      collector.stop("time");
    }, timeout);

    this.activeFlows.set(flowId, timeoutId);
  }

  /**
   * Clears a flow's timeout
   * @private
   */
  private static clearTimeout(flowId: string): void {
    const timeoutId = this.activeFlows.get(flowId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.activeFlows.delete(flowId);
    }
  }

  /**
   * Cleans up all active flows (for graceful shutdown)
   */
  static cleanup(): void {
    this.activeFlows.forEach((timeoutId) => clearTimeout(timeoutId));
    this.activeFlows.clear();
  }
}
