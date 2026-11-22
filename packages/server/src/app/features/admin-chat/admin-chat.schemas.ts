import { z } from "zod";

const SESSION_ID_MESSAGE = "sessionId is required";

export const StreamQuerySchema = z.object({
  sessionId: z.coerce
    .number({ error: SESSION_ID_MESSAGE })
    .int(SESSION_ID_MESSAGE)
    .positive(SESSION_ID_MESSAGE),
});

export type StreamQuery = z.infer<typeof StreamQuerySchema>;
