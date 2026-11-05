import { z } from "zod";
import { router, ownerProcedure } from "@/trpc/trpc";
import { contentGateway } from "@/services/content-gateway";

const DEFAULT_DAYS = 14;
const MAX_DAYS = 90;

export const ownerContentGatewayRouter = router({
  budget: router({
    get: ownerProcedure
      .meta({
        description:
          "The content gateway's budgets of calls on the CurseForge key and to Modrinth: this minute per pool of every process, the 429 holds, and the last UTC days of counts, today first",
      })
      .input(
        z
          .object({
            days: z.number().int().min(1).max(MAX_DAYS).default(DEFAULT_DAYS),
          })
          .default({ days: DEFAULT_DAYS }),
      )
      .query(({ input }) => contentGateway().budget({ days: input.days })),
  }),
});
