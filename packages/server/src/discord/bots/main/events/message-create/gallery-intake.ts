import config from "@/config";
import type { EventModule } from "@/discord/bots/common/loaders/event-loader";
import { container, Services } from "@/services/container";
import { GALLERY_INTAKE_REACTION, toIntakeMessage } from "@/services/gallery";
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
    const gallery = container.getSync(Services.GALLERY_SERVICE);
    const { created } = await gallery.ingest(toIntakeMessage(message));

    if (created.length > 0) {
      await message.react(GALLERY_INTAKE_REACTION);
    }
  } catch (error) {
    logger.error("Gallery intake error:", error);
  }
}
