import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { playerRepo } from "@/db";
import { playerId } from "@/trpc/utils";

export const playtimeRouter = router({
  get: adminProcedure
    .meta({
      description: "Get playtime statistics for a player across all servers.",
    })
    .input(z.object({ id: playerId() }))
    .query(async ({ input }) => {
      const playerData = await playerRepo.getDetailed(input.id);

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
