import { router, adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import { getService, Services } from "@/services";
import { MINECRAFT_SERVERS } from "@/services/playtime/config";
import { buildServerStatus } from "@/trpc/routers/public/servers";
import { minecraftRcon } from "@/utils/rcon";
import type { AdminLogActionFilters } from "@createrington/shared/db/admin_log_action.types";

function parseTpsResponse(response: string): {
  tps: number | null;
  meanTickTime: number | null;
} {
  const match = response.match(
    /Overall:\s*Mean tick time:\s*([\d.]+)\s*ms\.\s*Mean TPS:\s*([\d.]+)/,
  );
  if (!match) {
    return { tps: null, meanTickTime: null };
  }
  return {
    tps: parseFloat(match[2]),
    meanTickTime: parseFloat(match[1]),
  };
}

export const dashboardRouter = router({
  profile: adminProcedure
    .meta({ description: "Get admin profile data for the dashboard." })
    .query(async ({ ctx }) => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const recentFilters: AdminLogActionFilters = {
        adminDiscordId: ctx.user.discordId,
        performedAt: { $gte: sevenDaysAgo },
      };

      const [admin, totalActions, recentActions] = await Promise.all([
        Q.admin.find({ discordId: ctx.user.discordId }),
        Q.admin.log.action.count({ adminDiscordId: ctx.user.discordId }),
        Q.admin.log.action.count(recentFilters),
      ]);

      return {
        adminSince: admin?.createdAt ?? null,
        totalActions,
        recentActions,
      };
    }),
});
