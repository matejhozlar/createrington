import config from "@/config";
import type { EventModule } from "@/discord/bots/common/loaders/event-loader";
import { getServiceSync, Services } from "@/services";
import {
  GALLERY_INTAKE_REACTION,
  toIntakeMessage,
} from "@/services/gallery/intake";
import type { Client, Message } from "discord.js";

export const eventName: EventModule<"messageCreate">["eventName"] =
  "messageCreate";

export async function execute(
  _client: Client,
  message: Message,
): Promise<void> {
  if (message.author.bot) return;
  if (message.channelId !== config.gallery.intakeChannelId) return;

  try {
    const gallery = getServiceSync(Services.GALLERY_SERVICE);
    const { created } = await gallery.ingest(toIntakeMessage(message));

    if (created.length > 0) {
      await message.react(GALLERY_INTAKE_REACTION);
    }
  } catch (error) {
    logger.error("Gallery intake error:", error);
  }
}
