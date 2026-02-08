import { z } from "zod";
import { router, adminProcedure } from "../../trpc";
import { playerService } from "@/services/player";
import { parsePlayerId } from "../../utils";

export const ticketsRouter = router({
  list: adminProcedure
    .meta({ description: "Get paginated tickets for a player." })
    .input(
      z.object({
        id: z.string().min(1),
        page: z.number().int().min(0).default(0),
        limit: z.number().int().min(1).max(100).default(20),
      }),
    )
    .query(async ({ input }) => {
      const identifier = parsePlayerId(input.id);

      const [tickets, total] = await Promise.all([
        playerService.tickets.getAll(identifier, input.limit, input.page * input.limit),
        playerService.tickets.count(identifier),
      ]);

      return {
        tickets,
        pagination: {
          page: input.page,
          limit: input.limit,
          total,
          totalPages: Math.ceil(total / input.limit),
        },
      };
    }),
});
