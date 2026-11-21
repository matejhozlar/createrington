import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { playerSessionRepo } from "@/db";
import {
  paginationInput,
  buildPagination,
  id,
  playerId,
  pageOffset,
} from "@/trpc/utils";

export const sessionsRouter = router({
  list: adminProcedure
    .meta({
      description:
        "Get paginated session history for a player, optionally filtered by server",
    })
    .input(
      z.object({
        id: playerId(),
        serverId: id().optional(),
        ...paginationInput({ maxLimit: 200, defaultLimit: 50 }),
      }),
    )
    .query(async ({ input }) => {
      const { sessions, total: totalSessions } =
        await playerSessionRepo.getHistoryPage(
          input.id,
          input.serverId,
          input.limit,
          pageOffset(input),
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
