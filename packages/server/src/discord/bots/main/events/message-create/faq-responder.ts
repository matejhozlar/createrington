import type { EventModule } from "@/discord/bots/common/loaders/event-loader";
import { Discord } from "@/discord/constants";
import { getService, Services } from "@/services";
import type { Client, Message } from "discord.js";

export const eventName: EventModule<"messageCreate">["eventName"] =
  "messageCreate";

export const prodOnly = true;

export async function execute(client: Client, message: Message): Promise<void> {
  if (message.author.bot) return;
  if (message.channelId !== Discord.Channels.general.QUESTIONS) return;

  try {
    const faqService = await getService(Services.FAQ_SERVICE);
    await faqService.handleMessage(message);
  } catch (error) {
    logger.error("FAQ responder error:", error);
  }
}
