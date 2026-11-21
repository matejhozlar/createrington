import { z } from "zod";

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

const ticketMetadataSchema = z
  .object({
    closeMessageId: z.string().min(1).optional().catch(undefined),
    transcriptPath: z.string().min(1).optional().catch(undefined),
  })
  .catch({});

export type TicketMetadata = z.infer<typeof ticketMetadataSchema>;

export function readTicketMetadata(metadata: unknown): TicketMetadata {
  return ticketMetadataSchema.parse(metadata ?? {});
}
