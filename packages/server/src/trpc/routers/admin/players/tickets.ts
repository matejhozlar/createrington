import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { playerTicketRepo } from "@/db";
import {
  paginationInput,
  buildPagination,
  playerId,
  pageOffset,
} from "@/trpc/utils";

export const ticketsRouter = router({
  list: adminProcedure
    .meta({ description: "Get paginated tickets for a player" })
    .input(
      z.object({
        id: playerId(),
        ...paginationInput(),
      }),
    )
    .query(async ({ input }) => {
      const { tickets, total } = await playerTicketRepo.getPage(
        input.id,
        input.limit,
        pageOffset(input),
      );

      return {
        tickets,
        pagination: buildPagination(input.page, input.limit, total),
      };
    }),
});
