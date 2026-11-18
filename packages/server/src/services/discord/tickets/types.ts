export enum TicketType {
  GENERAL = "general",
  REPORT = "report",
}

export enum TicketUserAction {
  CREATED = "created",
  CLOSED = "closed",
  REOPENED = "reopened",
  DELETED = "deleted",
  TRANSCRIPT_GENERATED = "transcript_generated",
}

export interface TicketTypeConfig {
  type: TicketType;
  label: string;
  emoji: string;
  channelPrefix: string;
  description: string;
  allowedRoleIds: string[];
}

export interface CreateTicketOptions {
  type: TicketType;
  creatorId: string;
}

export const TicketButtonIds = {
  CREATE_PREFIX: "ticket:create:",
  CLOSE: "ticket:close:",
  CONFIRM_CLOSE: "ticket:confirm-close:",
  CANCEL_CLOSE: "ticket:cancel-close:",
  REOPEN: "ticket:reopen:",
  DELETE: "ticket:delete:",
  TRANSCRIPT: "ticket:transcript:",
};

export const TicketButtonGenerator = {
  create(type: TicketType): string {
    return `${TicketButtonIds.CREATE_PREFIX}${type}`;
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
