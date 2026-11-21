import type { Client } from "discord.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadCommandHandlers } from "../common/loaders/command-loader";
import { loadComponentHandlers } from "../common/loaders/component-loader";
import { registerInteractionHandler } from "./handlers/interaction-handler";
import { loadEventHandlers } from "../common/loaders/event-loader";
import { sweepRegistrationChannels } from "./registration-cleanup";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function setupMainBotHandlers(bot: Client): Promise<void> {
  logger.info("Loading main bot handlers...");

  const commandsPath = path.join(__dirname, "interactions", "slash-commands");
  const buttonsPath = path.join(__dirname, "interactions", "buttons");
  const modalsPath = path.join(__dirname, "interactions", "modals");
  const eventsPath = path.join(__dirname, "events");

  registerInteractionHandler(bot, {
    commands: await loadCommandHandlers(commandsPath),
    buttons: await loadComponentHandlers(buttonsPath),
    modals: await loadComponentHandlers(modalsPath),
  });
  await loadEventHandlers(bot, eventsPath);

  sweepRegistrationChannels(bot).catch((err) =>
    logger.error("Registration channel sweep failed:", err),
  );

  logger.info("Main bot handlers loaded");
}
