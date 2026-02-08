import { z } from "zod";
import { router, adminProcedure } from "../../../trpc";
import { playerService } from "@/services/player";
import { parsePlayerId } from "../../../utils";

export const sessionsRouter = router({
  list: adminProcedure
    .meta({
      description:
        "Get paginated session history for a player, optionally filtered by server.",
    })
    .input(
      z.object({
        id: z.string().min(1),
        serverId: z.number().int().positive().optional(),
        page: z.number().int().min(0).default(0),
        limit: z.number().int().min(1).max(200).default(50),
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
        pagination: {
          page: input.page,
          limit: input.limit,
          total: totalSessions,
          totalPages: Math.ceil(totalSessions / input.limit),
        },
      };
    }),
});
