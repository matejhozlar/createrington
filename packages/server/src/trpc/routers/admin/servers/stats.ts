import { z } from "zod";
import { adminProcedure } from "@/trpc/trpc";
import { Q, playtimeRepo } from "@/db";
import { getService, Services } from "@/services";
import { requireServer } from "@/services/mc-server/servers";
import {
  buildPagination,
  pageOffset,
  paginationInput,
  serverIdInput,
} from "@/trpc/utils";
import {
  buildServerStatus,
  buildServerStatuses,
  summarizeServerStatuses,
} from "@/services/playtime/server-status";

export const serverStatsProcedures = {
  list: adminProcedure
    .meta({ description: "List all servers with aggregate stats" })
    .query(async () => {
      const manager = await getService(Services.PLAYTIME_MANAGER_SERVICE);

      const statuses = buildServerStatuses(manager, buildServerStatus);
      const servers = await Promise.all(
        statuses.map(async (status) => {
          const serverStats = await Q.player.playtime.summary.getServerStats(
            status.serverId,
          );
          return {
            ...status,
            stats: {
              uniquePlayers: Number(serverStats.totalPlayers) || 0,
              totalHours: Math.floor(
                Number(serverStats.totalSeconds || 0) / 3600,
              ),
              totalSessions: serverStats.totalSessions,
              avgSessionSeconds: Number(serverStats.avgSessionSeconds) || 0,
            },
          };
        }),
      );

      const totalHours = await Q.player.playtime.summary.getTotalHours();
      const summary = summarizeServerStatuses(statuses);

      return {
        servers,
        totals: {
          totalServers: summary.totalServers,
          onlineServers: summary.onlineServers,
          totalPlayersOnline: summary.totalPlayers,
          totalHours,
        },
      };
    }),

  get: adminProcedure
    .meta({ description: "Get a single server with stats and leaderboard" })
    .input(z.object({ id: z.coerce.number().int().positive() }))
    .query(async ({ input }) => {
      const serverConfig = requireServer(input.id);

      const manager = await getService(Services.PLAYTIME_MANAGER_SERVICE);

      const service = manager.getService(input.id);
      const status = buildServerStatus(input.id, serverConfig, service);
      const { summary, leaderboard } = await playtimeRepo.getServerStats(
        input.id,
      );

      return {
        server: status,
        stats: {
          uniquePlayers: Number(summary.totalPlayers) || 0,
          totalHours: Math.floor(Number(summary.totalSeconds || 0) / 3600),
          avgSessionSeconds: Number(summary.avgSessionSeconds) || 0,
        },
        leaderboard: leaderboard.map((entry) => ({
          ...entry,
          totalSeconds: Number(entry.totalSeconds),
          totalSessions: Number(entry.totalSessions),
          avgSessionSeconds: Number(entry.avgSessionSeconds),
        })),
      };
    }),

  activity: adminProcedure
    .meta({ description: "Get daily activity for a server" })
    .input(
      serverIdInput.extend({
        days: z.number().int().min(7).max(365).default(30),
      }),
    )
    .query(async ({ input }) => {
      requireServer(input.serverId);

      const activity = await playtimeRepo.getServerActivity(
        input.serverId,
        input.days,
      );

      const totalPlayers = activity.reduce(
        (sum, d) => sum + Number(d.uniquePlayers),
        0,
      );
      const activeDays = activity.length;
      const peakPlayers = activity.reduce(
        (max, d) => Math.max(max, Number(d.uniquePlayers)),
        0,
      );

      return {
        activity: activity.map((d) => ({
          date: d.playDate,
          uniquePlayers: Number(d.uniquePlayers),
          totalHours: Number(d.totalSeconds) / 3600,
        })),
        summary: {
          peakDailyPlayers: peakPlayers,
          avgDailyPlayers:
            activeDays > 0 ? Math.round(totalPlayers / activeDays) : 0,
          activeDays,
          totalDays: input.days,
        },
      };
    }),

  heatmap: adminProcedure
    .meta({ description: "Get hourly activity heatmap for a server" })
    .input(
      serverIdInput.extend({
        days: z.number().int().min(7).max(365).default(30),
      }),
    )
    .query(async ({ input }) => {
      requireServer(input.serverId);

      const heatmapData = await Q.player.playtime.hourly.getServerHeatmap(
        input.serverId,
        input.days,
      );

      return {
        heatmap: heatmapData.map((d) => ({
          day: d.day,
          hour: Number(d.hour),
          uniquePlayers: Number(d.uniquePlayers),
          totalSeconds: Number(d.totalSeconds),
        })),
      };
    }),

  sessions: adminProcedure
    .meta({ description: "Get paginated sessions for a server" })
    .input(serverIdInput.extend(paginationInput({ defaultLimit: 20 })))
    .query(async ({ input }) => {
      requireServer(input.serverId);

      const { sessions, total } = await Q.player.session.getServerSessions(
        input.serverId,
        input.limit,
        pageOffset(input),
      );

      return {
        sessions,
        pagination: buildPagination(input.page, input.limit, total),
      };
    }),
};
