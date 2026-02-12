import { router, adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import type { AdminLogActionFilters } from "@createrington/shared/db/admin_log_action.types";

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
