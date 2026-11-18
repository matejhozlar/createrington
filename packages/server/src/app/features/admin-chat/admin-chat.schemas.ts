import { z } from "zod";

const ADMIN_CHAT_MODELS = ["claude-opus-5-5"] as const;
const SESSION_ID_MESSAGE = "sessionId is required";

const pageContextValueSchema = z.union([
  z.string().max(2000),
  z.number(),
  z.boolean(),
  z.null(),
]);

const pageContextSchema = z
  .record(z.string().max(100), pageContextValueSchema)
  .refine((val) => Object.keys(val).length <= 50, {
    message: "pageContext may contain at most 50 keys",
  });

const sessionId = z
  .number({ error: SESSION_ID_MESSAGE })
  .int(SESSION_ID_MESSAGE);

const sessionIdQuery = z.coerce
  .number({ error: SESSION_ID_MESSAGE })
  .int(SESSION_ID_MESSAGE);

const optionalQueryString = z.string().optional().catch(undefined);

export const SessionsQuerySchema = z.object({
  limit: optionalQueryString,
  cursor: optionalQueryString,
});

export const MessagesQuerySchema = z.object({
  sessionId: sessionIdQuery,
  afterId: optionalQueryString,
});

export const StreamQuerySchema = z.object({
  sessionId: sessionIdQuery,
});

export const StartBodySchema = z
  .object({
    pageContext: pageContextSchema.optional(),
    model: z.enum(ADMIN_CHAT_MODELS).optional(),
  })
  .prefault({});

export const SendBodySchema = z.object({
  sessionId,
  message: z.string().min(1).max(10_000),
  pageContext: pageContextSchema.optional(),
});

export const EndBodySchema = z.object({ sessionId });

export type SessionsQuery = z.infer<typeof SessionsQuerySchema>;
export type MessagesQuery = z.infer<typeof MessagesQuerySchema>;
export type StreamQuery = z.infer<typeof StreamQuerySchema>;
export type StartBody = z.infer<typeof StartBodySchema>;
export type SendBody = z.infer<typeof SendBodySchema>;
export type EndBody = z.infer<typeof EndBodySchema>;
