import { Client, GatewayIntentBits, Partials } from "discord.js";
import { loadCommandHandlers } from "./loaders/command-loader";
import { registerInteractionHandler } from "./handlers/interaction-handler";
import config from "@/config";
import { registerWelcomeHandler } from "./events/guild-member-add/welcome";

const BOT_TOKEN = config.discord.bots.main.token;

/**
 * Main Discord bot client instance
 *
 * Configured with neccessary intents and partials:
 * - Guilds: Acces to guild/server information
 * - GuildMembers: Acces to member join/leave events and member data
 * - GuildMessages: Access to message events in guild channels
 * - MessageContent: Access to actual message content (privileged intent)
 * - DirectMessages: Access to direct messages event
 * - Channel partial: Allows handling of uncached DM channels
 */
const mainBot = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

/**
 * Ready event handler - fires once when bot successfully connects
 *
 * Logs the bot's username and discriminator to confirm successful login
 * Exits early is user object is not properly initialized
 */
mainBot.once("clientReady", async () => {
  if (!mainBot.user) {
    logger.error("User is not initialized");
    return;
  }

  logger.info("Logged in as", mainBot.user.tag);
});

/**
 * Bot initializaton IIFE
 *
 * Performs the following statup sequence:
 * 1. Loads all command handlers from the commands directory
 * 2. Registers the interaction handler to route commands
 * 3. Authenticates and connects to Discord gateway
 *
 * If any step fails, logs the error and exits the process
 */
(async () => {
  const commandHandlers = await loadCommandHandlers();
  registerInteractionHandler(mainBot, commandHandlers);
  registerWelcomeHandler(mainBot);

  await mainBot.login(BOT_TOKEN);
})().catch((error) => {
  logger.error("Failed to initialize:", error);
  process.exit(1);
});

export default mainBot;
