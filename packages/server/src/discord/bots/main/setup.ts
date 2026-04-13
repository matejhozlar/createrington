import type { Client } from "discord.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadCommandHandlers } from "../common/loaders/command-loader";
import { loadButtonHandlers } from "../common/loaders/button-loader";
import { registerInteractionHandler } from "./handlers/interaction-handler";
import { loadEventHandlers } from "../common/loaders/event-loader";
import { sweepRegistrationChannels } from "./registration-cleanup";
import { buildInviteCache } from "./invites";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Loads command, button, and event handlers for the main bot
 *
 * Must be called after bot login but before other services that
 * depend on interaction handling.
 *
 * @param bot - The Discord client instance for the main bot
 */
export async function setupMainBotHandlers(bot: Client): Promise<void> {
  logger.info("Loading main bot handlers...");

  const commandsPath = path.join(__dirname, "interactions", "slash-commands");
  const buttonsPath = path.join(__dirname, "interactions", "buttons");
  const eventsPath = path.join(__dirname, "events");

  const commandHandlers = await loadCommandHandlers(commandsPath);
  const buttonHandlers = await loadButtonHandlers(buttonsPath);

  registerInteractionHandler(bot, commandHandlers, buttonHandlers);
  await loadEventHandlers(bot, eventsPath);

  // Seed the invite-use cache so guildMemberAdd can diff against it to identify
  // which waitlist invite a joining member consumed. Must happen here because
  // setup runs after bot login, so a `once` clientReady handler would never fire.
  await buildInviteCache(bot);

  // Re-schedule any pending registration channel auto-closes from before restart
  sweepRegistrationChannels(bot).catch((err) =>
    logger.error("Registration channel sweep failed:", err),
  );

  logger.info("Main bot handlers loaded");
}
