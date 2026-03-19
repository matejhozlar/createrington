import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { Q, R } from "@/db";
import { getService, Services } from "@/services";
import { maintenanceService } from "@/services/maintenance";
import { MINECRAFT_SERVERS, getServerById } from "@/services/playtime/config";
import { buildPagination, paginationInput, trpcError } from "@/trpc/utils";
import {
  buildServerStatus,
  type ServerStatus,
} from "@/trpc/routers/public/servers";

/** Admin servers router — server list with stats, detail view, activity, heatmap, and sessions. */
export const adminServersRouter = router({
  list: adminProcedure
    .meta({ description: "List all servers with aggregate stats" })
    .query(async () => {
      const manager = await getService(Services.PLAYTIME_MANAGER_SERVICE);

      const servers: Array<
        ServerStatus & {
          stats: {
            uniquePlayers: number;
            totalHours: number;
            totalSessions: number;
            avgSessionSeconds: number;
          };
        }
      > = [];

      for (const [serverId, serverConfig] of Object.entries(
        MINECRAFT_SERVERS,
      )) {
        const id = parseInt(serverId, 10);
        const service = manager.getService(id);
        const status = buildServerStatus(id, serverConfig, service);

        const serverStats = await Q.player.playtime.summary.getServerStats(id);

        servers.push({
          ...status,
          stats: {
            uniquePlayers: Number(serverStats.totalPlayers) || 0,
            totalHours: Math.floor(
              Number(serverStats.totalSeconds || 0) / 3600,
            ),
            totalSessions:
              Number(serverStats.totalSeconds || 0) > 0
                ? Number(serverStats.totalPlayers || 0)
                : 0,
            avgSessionSeconds: Number(serverStats.avgSessionSeconds) || 0,
          },
        });
      }

      servers.sort((a, b) => a.serverId - b.serverId);

      const totalHours = await Q.player.playtime.summary.getTotalHours();

      return {
        servers,
        totals: {
          totalServers: servers.length,
          onlineServers: servers.filter((s) => s.status === "online").length,
          totalPlayersOnline: servers.reduce(
            (sum, s) => sum + s.playerCount,
            0,
          ),
          totalHours,
        },
      };
    }),

  get: adminProcedure
    .meta({ description: "Get a single server with stats and leaderboard" })
    .input(z.object({ id: z.coerce.number().int().positive() }))
    .query(async ({ input }) => {
      const serverConfig = getServerById(input.id);
      if (!serverConfig) {
        throw trpcError.badRequest(`Server with id ${input.id} not found`);
      }

      const manager = await getService(Services.PLAYTIME_MANAGER_SERVICE);

      const service = manager.getService(input.id);
      const status = buildServerStatus(input.id, serverConfig, service);
      const { summary, leaderboard } = await R.playtimeRepo.getServerStats(
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
      z.object({
        serverId: z.coerce.number().int().positive(),
        days: z.number().int().min(7).max(365).default(30),
      }),
    )
    .query(async ({ input }) => {
      const serverConfig = getServerById(input.serverId);
      if (!serverConfig) {
        throw trpcError.badRequest(
          `Server with id ${input.serverId} not found`,
        );
      }

      const activity = await R.playtimeRepo.getServerActivity(
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
      z.object({
        serverId: z.coerce.number().int().positive(),
        days: z.number().int().min(7).max(365).default(30),
      }),
    )
    .query(async ({ input }) => {
      const serverConfig = getServerById(input.serverId);
      if (!serverConfig) {
        throw trpcError.badRequest(
          `Server with id ${input.serverId} not found`,
        );
      }

      const heatmapData = await R.playtimeRepo.getServerHeatmap(
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
    .input(
      z.object({
        serverId: z.coerce.number().int().positive(),
        ...paginationInput({ defaultLimit: 20 }),
      }),
    )
    .query(async ({ input }) => {
      const serverConfig = getServerById(input.serverId);
      if (!serverConfig) {
        throw trpcError.badRequest(
          `Server with id ${input.serverId} not found`,
        );
      }

      const offset = input.page * input.limit;
      const { sessions, total } = await Q.player.session.getServerSessions(
        input.serverId,
        input.limit,
        offset,
      );

      return {
        sessions,
        pagination: buildPagination(input.page, input.limit, total),
      };
    }),

  maintenanceStatus: adminProcedure
    .meta({ description: "Get maintenance mode status for a server" })
    .input(z.object({ serverId: z.coerce.number().int().positive() }))
    .query(({ input }) => {
      return { enabled: maintenanceService.isInMaintenance(input.serverId) };
    }),

  toggleMaintenance: adminProcedure
    .meta({
      description:
        "Toggle maintenance mode for a server. Renames the whitelist file via SFTP and reloads via RCON.",
    })
    .input(
      z.object({
        serverId: z.coerce.number().int().positive(),
        enabled: z.boolean(),
      }),
    )
    .mutation(async ({ input }) => {
      const serverConfig = getServerById(input.serverId);
      if (!serverConfig) {
        throw trpcError.badRequest(
          `Server with id ${input.serverId} not found`,
        );
      }

      try {
        if (input.enabled) {
          await maintenanceService.enable(input.serverId);
        } else {
          await maintenanceService.disable(input.serverId);
        }
      } catch (err) {
        throw trpcError.internal(
          err instanceof Error ? err.message : "Failed to toggle maintenance",
        );
      }

      // Broadcast updated server status via WebSocket
      try {
        const ws = await getService(Services.WEBSOCKET_SERVICE);
        await ws.triggerServerStatusUpdate(input.serverId);
      } catch {
        // Non-critical — UI will catch up on next poll
      }

      return { enabled: input.enabled };
    }),
});
