import { z } from "zod";

const SERVER_SLUG_RE = /^[a-z0-9-]{1,32}$/;
const SERVER_SLUG_MESSAGE = "server must be a valid server slug";

export const ServerStatusQuerySchema = z.object({
  server: z
    .union(
      [
        z.literal("").transform(() => undefined),
        z.string().regex(SERVER_SLUG_RE, SERVER_SLUG_MESSAGE),
      ],
      { error: SERVER_SLUG_MESSAGE },
    )
    .optional(),
});

export type ServerStatusQuery = z.infer<typeof ServerStatusQuerySchema>;
