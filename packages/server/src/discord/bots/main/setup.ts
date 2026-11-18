import type { Client } from "discord.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadCommandHandlers } from "../common/loaders/command-loader";
import { loadButtonHandlers } from "../common/loaders/button-loader";
import { registerInteractionHandler } from "./handlers/interaction-handler";
import { loadEventHandlers } from "../common/loaders/event-loader";
import { sweepRegistrationChannels } from "./registration-cleanup";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function setupMainBotHandlers(bot: Client): Promise<void> {
  logger.info("Loading main bot handlers...");

  const commandsPath = path.join(__dirname, "interactions", "slash-commands");
  const buttonsPath = path.join(__dirname, "interactions", "buttons");
  const eventsPath = path.join(__dirname, "events");

  const commandHandlers = await loadCommandHandlers(commandsPath);
  const buttonHandlers = await loadButtonHandlers(buttonsPath);

  registerInteractionHandler(bot, commandHandlers, buttonHandlers);
  await loadEventHandlers(bot, eventsPath);

  sweepRegistrationChannels(bot).catch((err) =>
    logger.error("Registration channel sweep failed:", err),
  );

  logger.info("Main bot handlers loaded");
}
