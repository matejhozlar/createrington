import type { EventModule } from "@/discord/bots/common/loaders/event-loader";
import { Discord } from "@/discord/constants";
import { container, Services } from "@/services/container";
import type { Client, Message } from "discord.js";

/**
 * FAQ auto-responder event handler
 *
 * Listens for messages in the questions channel and delegates
 * them to the FAQ service for automatic keyword-based responses.
 */
export const eventName: EventModule<"messageCreate">["eventName"] =
  "messageCreate";

export const prodOnly = false;

/**
 * Executes when a message is created in the questions channel
 *
 * @param client - The Discord client instance
 * @param message - The message that was created
 */
export async function execute(client: Client, message: Message): Promise<void> {
  if (message.author.bot) return;
  if (message.channelId !== Discord.Channels.general.QUESTIONS) return;

  try {
    const faqService = container.getSync(Services.FAQ_SERVICE);
    await faqService.handleMessage(message);
  } catch (error) {
    logger.error("FAQ responder error:", error);
  }
}
