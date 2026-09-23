import cfg from "@/config";
import { Discord } from "@/discord/constants";
import { TicketType, type TicketTypeConfig } from "./types";

/**
 * System-wide ticket configuration constants
 *
 * These IDs define the Discord resources used by the ticket system:
 * - Category where ticket channels are created
 * - Channel where ticket transcripts are sent
 * - Roles that have access to different ticket types
 */
export const TicketSystemIds = {
  /** Discord category ID where all ticket channels are created */
  TICKET_CATEGORY: cfg.discord.guild.categories.tickets,
  /** Discord channel ID where ticket transcripts are sent when closed */
  TRANSCRIPT_CHANNEL: Discord.Channels.administration.TRANSCRIPTS,
  /** Admin role ID with access to general tickets */
  ADMIN_ROLE: Discord.Roles.ADMIN,
  /** Owner role ID with access to all tickets */
  OWNER_ROLE: Discord.Roles.OWNER,
} as const;

/**
 * Configuration registry for all ticket types
 *
 * Each ticket type must be defined here with:
 * - Display properties (label, emoji, description)
 * - Channel naming prefix
 * - Role-based access control (which roles can view/manage)
 *
 * Add new ticket types by adding entries to this record.
 */
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
 * @param type - The ticket type to get configuration for
 * @returns The ticket type configuration object
 * @throws Error if no configuration exists for the given type
 */
export function getTicketTypeConfig(type: TicketType): TicketTypeConfig {
  const config = TICKET_TYPE_CONFIGS[type];
  if (!config) {
    throw new Error(`No configuration found for ticket type: ${type}`);
  }
  return config;
}

/**
 * Gets all available ticket type configurations
 *
 * @returns Array of all registered ticket type configurations
 */
export function getAllTicketTypes(): TicketTypeConfig[] {
  return Object.values(TICKET_TYPE_CONFIGS);
}

/**
 * Type guard to check if a string is a valid ticket type
 *
 * @param type - The string to check
 * @returns True if the string is a registered ticket type
 */
export function isValidTicketType(type: string): type is TicketType {
  return type in TICKET_TYPE_CONFIGS;
}
