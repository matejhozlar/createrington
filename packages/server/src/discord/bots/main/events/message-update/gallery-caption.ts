import config from "@/config";
import type { EventModule } from "@/discord/bots/common/loaders/event-loader";
import { container, Services } from "@/services/container";
import type { Client, Message, PartialMessage } from "discord.js";

export const eventName: EventModule<"messageUpdate">["eventName"] =
  "messageUpdate";

export async function execute(
  _client: Client,
  _oldMessage: Message | PartialMessage,
  updatedMessage: Message | PartialMessage,
): Promise<void> {
  if (updatedMessage.channelId !== config.gallery.intakeChannelId) return;

  try {
    const message = updatedMessage.partial
      ? await updatedMessage.fetch()
      : updatedMessage;
    if (message.author.bot) return;

    const gallery = container.getSync(Services.GALLERY_SERVICE);
    await gallery.updateCaption(message.id, message.content);
  } catch (error) {
    logger.error("Gallery caption update error:", error);
  }
}
