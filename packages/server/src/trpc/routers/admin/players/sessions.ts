import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { playerService } from "@/services/player";
import { parsePlayerId, paginationInput, buildPagination } from "@/trpc/utils";

/** Admin sessions router — paginated session history for a player. */
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

      const totalSessions = await playerService.sessions.count(
        identifier,
        input.serverId,
      );

      const sessions = await playerService.sessions.getHistory(
        identifier,
        input.serverId,
        input.limit,
        input.page * input.limit,
      );

      return {
        sessions: sessions.map((s) => ({
          ...s,
          secondsPlayed: s.secondsPlayed?.toString() || null,
        })),
        pagination: buildPagination(input.page, input.limit, totalSessions),
      };
    }),
});
