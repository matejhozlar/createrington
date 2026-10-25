import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { playerService } from "@/services/player";
import { parsePlayerId, paginationInput, buildPagination } from "@/trpc/utils";

/** Admin tickets router: paginated ticket list for a player. */
export const ticketsRouter = router({
  list: adminProcedure
    .meta({ description: "Get paginated tickets for a player" })
    .input(
      z.object({
        id: z.string().min(1),
        ...paginationInput(),
      }),
    )
    .query(async ({ input }) => {
      const identifier = parsePlayerId(input.id);

      const { tickets, total } = await playerService.tickets.getPage(
        identifier,
        input.limit,
        input.page * input.limit,
      );

      return {
        tickets,
        pagination: buildPagination(input.page, input.limit, total),
      };
    }),
});
