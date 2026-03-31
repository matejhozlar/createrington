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
import { Discord } from "@/discord/constants";
import { EmbedPresets } from "@/discord/embeds";

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
      const schedule = maintenanceService.getScheduledMaintenance(
        input.serverId,
      );
      return {
        enabled: maintenanceService.isInMaintenance(input.serverId),
        schedule: schedule
          ? {
              id: schedule.id,
              scheduledAt: schedule.scheduledAt.toISOString(),
              estimatedMinutes: schedule.estimatedMinutes,
              status: schedule.status as "scheduled" | "active",
            }
          : null,
      };
    }),

  toggleMaintenance: adminProcedure
    .meta({
      description:
        "Toggle maintenance mode for a server. Renames the whitelist file via SFTP and reloads via RCON",
    })
    .input(
      z.object({
        serverId: z.coerce.number().int().positive(),
        enabled: z.boolean(),
        announce: z.boolean().optional().default(false),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const serverConfig = getServerById(input.serverId);
      if (!serverConfig) {
        throw trpcError.badRequest(
          `Server with id ${input.serverId} not found`,
        );
      }

      try {
        if (input.enabled) {
          // Cancel any pending schedule before instant activation
          const pending = maintenanceService.getScheduledMaintenance(
            input.serverId,
          );
          if (pending?.status === "scheduled") {
            await maintenanceService.cancelScheduledMaintenance(input.serverId);
          }

          // Get online player usernames to kick
          const manager = await getService(Services.PLAYTIME_MANAGER_SERVICE);
          const service = manager.getService(input.serverId);
          const onlinePlayers = (service?.getActiveSessions() ?? []).map(
            (s) => s.username,
          );

          await maintenanceService.enable(input.serverId, onlinePlayers);
        } else {
          await maintenanceService.disable(input.serverId);

          // Send "maintenance ended" announcement if requested
          if (input.announce) {
            try {
              const embed = EmbedPresets.announcements.maintenanceEnded();
              await Discord.Messages.send({
                channelId: Discord.Channels.createringtonOfficial.ANNOUNCEMENTS,
                embeds: embed.build(),
              });
            } catch (err) {
              logger.warn(
                `Failed to send maintenance ended announcement: ${err}`,
              );
            }
          }
        }
      } catch (err) {
        throw trpcError.internal(
          err instanceof Error ? err.message : "Failed to toggle maintenance",
        );
      }

      await Q.admin.log.action.logAction({
        adminDiscordId: ctx.user.discordId,
        adminUsername: ctx.user.minecraftUsername,
        actionType: input.enabled
          ? "server_maintenance_enable"
          : "server_maintenance_disable",
        description: `${input.enabled ? "Enabled" : "Disabled"} maintenance on ${serverConfig.name}`,
        serverId: input.serverId,
      });

      // Broadcast updated server status via WebSocket
      try {
        const ws = await getService(Services.WEBSOCKET_SERVICE);
        await ws.triggerServerStatusUpdate(input.serverId);
      } catch {
        // Non-critical — UI will catch up on next poll
      }

      return { enabled: input.enabled };
    }),

  scheduleMaintenance: adminProcedure
    .meta({
      description:
        "Schedule maintenance for a future time. Sends initial Discord announcement and sets up warning timers",
    })
    .input(
      z.object({
        serverId: z.coerce.number().int().positive(),
        type: z.enum(["maintenance", "modpack_update"]).default("maintenance"),
        scheduledAt: z.string().datetime({ offset: true }),
        estimatedMinutes: z.number().int().min(1).max(10080),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const serverConfig = getServerById(input.serverId);
      if (!serverConfig) {
        throw trpcError.badRequest(
          `Server with id ${input.serverId} not found`,
        );
      }

      const scheduledAt = new Date(input.scheduledAt);
      if (scheduledAt.getTime() <= Date.now()) {
        throw trpcError.badRequest("Scheduled time must be in the future");
      }

      // Check for existing scheduled/active maintenance
      const existing = maintenanceService.getScheduledMaintenance(
        input.serverId,
      );
      if (existing) {
        throw trpcError.badRequest(
          `Server already has ${existing.status} maintenance (schedule #${existing.id})`,
        );
      }

      if (maintenanceService.isInMaintenance(input.serverId)) {
        throw trpcError.badRequest("Server is already in maintenance mode");
      }

      const schedule = await maintenanceService.scheduleMaintenance({
        serverId: input.serverId,
        scheduledAt,
        estimatedMinutes: input.estimatedMinutes,
        scheduledByDiscordId: ctx.user.discordId,
      });

      // Send initial Discord announcement via main bot
      try {
        const embed = EmbedPresets.announcements.maintenance({
          type: input.type,
          startsAt: scheduledAt,
          estimatedMinutes: input.estimatedMinutes,
        });

        await Discord.Messages.send({
          channelId: Discord.Channels.createringtonOfficial.ANNOUNCEMENTS,
          embeds: embed.build(),
        });
      } catch (err) {
        logger.warn(`Failed to send maintenance announcement: ${err}`);
      }

      // Broadcast server status update
      try {
        const ws = await getService(Services.WEBSOCKET_SERVICE);
        await ws.triggerServerStatusUpdate(input.serverId);
      } catch {
        // Non-critical
      }

      await Q.admin.log.action.logAction({
        adminDiscordId: ctx.user.discordId,
        adminUsername: ctx.user.minecraftUsername,
        actionType: "server_maintenance_schedule",
        description: `Scheduled maintenance on ${serverConfig.name} for ${scheduledAt.toISOString()} (~${input.estimatedMinutes}min)`,
        serverId: input.serverId,
        metadata: {
          scheduledAt: scheduledAt.toISOString(),
          estimatedMinutes: input.estimatedMinutes,
        },
      });

      return {
        id: schedule.id,
        scheduledAt: schedule.scheduledAt.toISOString(),
      };
    }),

  cancelScheduledMaintenance: adminProcedure
    .meta({
      description: "Cancel a pending scheduled maintenance for a server.",
    })
    .input(z.object({ serverId: z.coerce.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const schedule = maintenanceService.getScheduledMaintenance(
        input.serverId,
      );
      if (!schedule || schedule.status !== "scheduled") {
        throw trpcError.badRequest(
          "No pending scheduled maintenance for this server",
        );
      }

      await maintenanceService.cancelScheduledMaintenance(input.serverId);

      const serverConfig = getServerById(input.serverId);
      await Q.admin.log.action.logAction({
        adminDiscordId: ctx.user.discordId,
        adminUsername: ctx.user.minecraftUsername,
        actionType: "server_maintenance_cancel",
        description: `Cancelled scheduled maintenance on ${serverConfig?.name ?? `server ${input.serverId}`}`,
        serverId: input.serverId,
      });

      // Broadcast server status update
      try {
        const ws = await getService(Services.WEBSOCKET_SERVICE);
        await ws.triggerServerStatusUpdate(input.serverId);
      } catch {
        // Non-critical
      }

      return { cancelled: true };
    }),
});
