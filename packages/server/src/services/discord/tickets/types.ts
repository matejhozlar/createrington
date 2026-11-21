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

export function isTicketType(value: string): value is TicketType {
  return (Object.values(TicketType) as string[]).includes(value);
}
