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

  serverOverview: adminProcedure
    .meta({
      description:
        "Get server statuses with TPS data and total registered player count.",
    })
    .query(async () => {
      const manager = await getService(Services.PLAYTIME_MANAGER_SERVICE);

      const serverEntries = Object.entries(MINECRAFT_SERVERS).map(
        ([id, cfg]) => ({
          id: parseInt(id, 10),
          cfg,
          status: buildServerStatus(
            parseInt(id, 10),
            cfg,
            manager.getService(parseInt(id, 10)),
          ),
        }),
      );

      const tpsResults = await Promise.allSettled(
        serverEntries.map(async ({ id, status }) => {
          if (status.status !== "online") {
            return { id, tps: null, meanTickTime: null };
          }
          const response = await minecraftRcon.send(id, "neoforge tps");
          return { id, ...parseTpsResponse(response) };
        }),
      );

      const tpsMap = new Map<
        number,
        { tps: number | null; meanTickTime: number | null }
      >();
      for (const result of tpsResults) {
        if (result.status === "fulfilled") {
          tpsMap.set(result.value.id, {
            tps: result.value.tps,
            meanTickTime: result.value.meanTickTime,
          });
        }
      }

      let totalOnlinePlayers = 0;
      const servers = serverEntries.map(({ id, status }) => {
        totalOnlinePlayers += status.playerCount;
        const tpsData = tpsMap.get(id);
        return {
          serverId: id,
          serverName: status.serverName,
          status: status.status,
          playerCount: status.playerCount,
          maxPlayers: status.maxPlayers,
          tps: tpsData?.tps ?? null,
          meanTickTime: tpsData?.meanTickTime ?? null,
        };
      });

      const totalRegisteredPlayers = await Q.player.count();

      return {
        servers,
        totalRegisteredPlayers,
        totalOnlinePlayers,
      };
    }),

  activityFeed: adminProcedure
    .meta({
      description:
        "Get recent activity across admin actions, sessions, Discord joins, bans, and strikes.",
    })
    .query(async () => {
      const [
        recentAdminActions,
        recentSessions,
        recentDiscordJoins,
        recentBans,
        recentStrikes,
      ] = await Promise.all([
        Q.admin.log.action.findAll(
          {},
          { limit: 10, orderBy: "performedAt", orderDirection: "desc" },
        ),
        Q.player.session.findAll(
          {},
          { limit: 10, orderBy: "sessionStart", orderDirection: "desc" },
        ),
        Q.discord.guild.member.join.findAll(
          {},
          { limit: 10, orderBy: "joinedAt", orderDirection: "desc" },
        ),
        Q.player.ban.getRecent(10, false),
        Q.player.strike.getRecent(10, false),
      ]);

      return {
        recentAdminActions,
        recentSessions,
        recentDiscordJoins,
        recentBans,
        recentStrikes,
      };
    }),
});
