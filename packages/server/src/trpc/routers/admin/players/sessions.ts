import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { playerSessionRepo } from "@/db";
import { parsePlayerId, paginationInput, buildPagination } from "@/trpc/utils";

export const sessionsRouter = router({
  list: adminProcedure
    .meta({
      description:
        "Get paginated session history for a player, optionally filtered by server",
    })
    .input(
      z.object({
        id: z.string().min(1),
        serverId: z.number().int().positive().optional(),
        ...paginationInput({ maxLimit: 200, defaultLimit: 50 }),
      }),
    )
    .query(async ({ input }) => {
      const identifier = parsePlayerId(input.id);

      const { sessions, total: totalSessions } =
        await playerSessionRepo.getHistoryPage(
          identifier,
          input.serverId,
          input.limit,
          input.page * input.limit,
        );

      return {
        sessions: sessions.map((s) => ({
          ...s,
          secondsPlayed: s.secondsPlayed?.toString() || null,
          activeSeconds: s.activeSeconds.toString(),
        })),
        pagination: buildPagination(input.page, input.limit, totalSessions),
      };
    }),
});
