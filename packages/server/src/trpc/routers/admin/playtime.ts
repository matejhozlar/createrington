import { z } from "zod";
import { router, adminProcedure } from "../../trpc";
import { playerService } from "@/services/player";
import { parsePlayerId } from "../../utils";

export const playtimeRouter = router({
  get: adminProcedure
    .meta({ description: "Get playtime statistics for a player across all servers." })
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ input }) => {
      const identifier = parsePlayerId(input.id);

      const playerData = await playerService.core.getDetailed(identifier);

      return {
        summary: playerData.playtime.summary.map((s) => ({
          ...s,
          totalSeconds: s.totalSeconds.toString(),
          avgSessionSeconds: s.avgSessionSeconds?.toString() || "0",
        })),
        totalSeconds: playerData.playtime.totalSeconds,
        totalSessions: playerData.playtime.totalSessions,
      };
    }),
});
