/**
 * Ticket System Type Definitions
 */

/** Available ticket categories */
export enum TicketType {
  GENERAL = "general",
  REPORT = "report",
}

/** Lifecycle states a ticket can be in */
export enum TicketStatus {
  OPEN = "open",
  CLOSED = "closed",
  DELETED = "deleted",
}

/** Actions a user or moderator can perform on a ticket */
export enum TicketUserAction {
  CREATED = "created",
  CLOSED = "closed",
  REOPENED = "reopened",
  DELETED = "deleted",
  TRANSCRIPT_GENERATED = "transcript_generated",
}

/** Configuration for a specific ticket type */
export interface TicketTypeConfig {
  type: TicketType;
  label: string;
  emoji: string;
  /** Prefix used when naming the Discord channel (e.g., "general-0001") */
  channelPrefix: string;
  description: string;
  /** Discord role IDs that can view and manage tickets of this type */
  allowedRoleIds: string[];
}

/** Options required to create a new ticket */
export interface CreateTicketOptions {
  type: TicketType;
  /** Discord user ID of the ticket creator */
  creatorId: string;
}

/** Discord button custom ID prefixes for ticket interactions */
export const TicketButtonIds = {
  CREATE_PREFIX: "ticket:create:",
  CLOSE: "ticket:close:",
  CONFIRM_CLOSE: "ticket:confirm-close:",
  CANCEL_CLOSE: "ticket:cancel-close:",
  REOPEN: "ticket:reopen:",
  DELETE: "ticket:delete:",
  TRANSCRIPT: "ticket:transcript:",
};

/** Helper to generate button custom IDs for ticket interactions */
export const TicketButtonGenerator = {
  create(type: TicketType): string {
    return `${TicketButtonIds.CREATE_PREFIX}${type}`;
  },

  close(ticketId: number): string {
    return `${TicketButtonIds.CLOSE}${ticketId}`;
  },

  confirmClose(ticketId: number): string {
    return `${TicketButtonIds.CONFIRM_CLOSE}${ticketId}`;
  },

  cancelClose(ticketId: number): string {
    return `${TicketButtonIds.CANCEL_CLOSE}${ticketId}`;
  },

  reopen(ticketId: number): string {
    return `${TicketButtonIds.REOPEN}${ticketId}`;
  },

  delete(ticketId: number): string {
    return `${TicketButtonIds.DELETE}${ticketId}`;
  },

  transcript(ticketId: number): string {
    return `${TicketButtonIds.TRANSCRIPT}${ticketId}`;
  },
};

/** Parses a button custom ID into action type and ticket/type identifier */
export function parseTicketButtonId(customId: string): {
  action: string;
  ticketId?: number;
  type?: TicketType;
} | null {
  if (customId.startsWith(TicketButtonIds.CREATE_PREFIX)) {
    const type = customId.replace(
      TicketButtonIds.CREATE_PREFIX,
      "",
    ) as TicketType;
    return { action: "create", type };
  }

  const patterns = [
    { prefix: TicketButtonIds.CLOSE, action: "close" },
    { prefix: TicketButtonIds.CONFIRM_CLOSE, action: "confirm-close" },
    { prefix: TicketButtonIds.CANCEL_CLOSE, action: "cancel-close" },
    { prefix: TicketButtonIds.REOPEN, action: "reopen" },
    { prefix: TicketButtonIds.DELETE, action: "delete" },
    { prefix: TicketButtonIds.TRANSCRIPT, action: "transcript" },
  ];

  for (const pattern of patterns) {
    if (customId.startsWith(pattern.prefix)) {
      const ticketId = parseInt(customId.replace(pattern.prefix, ""));
      if (!isNaN(ticketId)) {
        return { action: pattern.action, ticketId };
      }
    }
  }

  return null;
}
