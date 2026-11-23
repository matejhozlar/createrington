import cfg from "@/config";
import { Discord } from "@/discord/constants";
import { TicketType, type TicketTypeConfig } from "./types";

export const TicketSystemIds = {
  TICKET_CATEGORY: cfg.discord.guild.categories.tickets,
  TRANSCRIPT_CHANNEL: Discord.Channels.administration.TRANSCRIPTS,
  ADMIN_ROLE: Discord.Roles.ADMIN,
  OWNER_ROLE: Discord.Roles.OWNER,
} as const;

export const TICKET_TYPE_CONFIGS: Record<TicketType, TicketTypeConfig> = {
  [TicketType.GENERAL]: {
    type: TicketType.GENERAL,
    label: "General Support",
    emoji: "🎫",
    channelPrefix: "general",
    description: "Get help with general questions and issues",
    allowedRoleIds: [TicketSystemIds.ADMIN_ROLE, TicketSystemIds.OWNER_ROLE],
  },

  [TicketType.REPORT]: {
    type: TicketType.REPORT,
    label: "Report Staff Member",
    emoji: "⚠️",
    channelPrefix: "report",
    description: "Report a staff member's behavior or actions",
    allowedRoleIds: [TicketSystemIds.OWNER_ROLE],
  },
};

/**
 * Retrieves the configuration for a specific ticket type
 *
 * @throws Error if no configuration exists for the given type
 */
export function getTicketTypeConfig(type: TicketType): TicketTypeConfig {
  const config = TICKET_TYPE_CONFIGS[type];
  if (!config) {
    throw new Error(`No configuration found for ticket type: ${type}`);
  }
  return config;
}

/** Gets all available ticket type configurations */
export function getAllTicketTypes(): TicketTypeConfig[] {
  return Object.values(TICKET_TYPE_CONFIGS);
}
