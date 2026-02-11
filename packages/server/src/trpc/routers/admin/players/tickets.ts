import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { playerService } from "@/services/player";
import { parsePlayerId, paginationInput, buildPagination } from "@/trpc/utils";

export const ticketsRouter = router({
  list: adminProcedure
    .meta({ description: "Get paginated tickets for a player." })
    .input(
      z.object({
        id: z.string().min(1),
        ...paginationInput(),
      }),
    )
    .query(async ({ input }) => {
      const identifier = parsePlayerId(input.id);

      const [tickets, total] = await Promise.all([
        playerService.tickets.getAll(
          identifier,
          input.limit,
          input.page * input.limit,
        ),
        playerService.tickets.count(identifier),
      ]);

      return {
        tickets,
        pagination: buildPagination(input.page, input.limit, total),
      };
    }),
});
