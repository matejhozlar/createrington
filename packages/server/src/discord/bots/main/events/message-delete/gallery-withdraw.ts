import config from "@/config";
import type { EventModule } from "@/discord/bots/common/loaders/event-loader";
import { getService, Services } from "@/services";
import type { Client, Message, PartialMessage } from "discord.js";

export const eventName: EventModule<"messageDelete">["eventName"] =
  "messageDelete";

export async function execute(
  _client: Client,
  message: Message | PartialMessage,
): Promise<void> {
  if (message.channelId !== config.gallery.intakeChannelId) return;

  try {
    const gallery = await getService(Services.GALLERY_SERVICE);
    await gallery.withdrawByMessage(message.id);
  } catch (error) {
    logger.error("Gallery withdraw error:", error);
  }
}
