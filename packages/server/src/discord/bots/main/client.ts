import { Client, GatewayIntentBits, Partials } from "discord.js";

/**
 * Main Discord bot client instance
 *
 * NOTE: This is just the client definition.
 * Login happens in services/bootstrap.ts
 */
export const mainBot = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildInvites,
  ],
  partials: [Partials.Channel, Partials.GuildMember],
});
