import { z } from "zod";
import { adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import { getService, Services } from "@/services";
import { maintenanceService } from "@/services/maintenance";
import { getServerById } from "@/services/playtime/config";
import { trpcError, auditActor } from "@/trpc/utils";
import { Discord } from "@/discord/constants";
import { EmbedPresets } from "@/discord/embeds";

export const serverMaintenanceProcedures = {
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
          const pending = maintenanceService.getScheduledMaintenance(
            input.serverId,
          );
          if (pending?.status === "scheduled") {
            await maintenanceService.cancelScheduledMaintenance(input.serverId);
          }

          const manager = await getService(Services.PLAYTIME_MANAGER_SERVICE);
          const service = manager.getService(input.serverId);
          const onlinePlayers = (service?.getActiveSessions() ?? []).map(
            (s) => s.username,
          );

          await maintenanceService.enable(input.serverId, onlinePlayers);
        } else {
          await maintenanceService.disable(input.serverId);

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
        ...auditActor(ctx),
        actionType: input.enabled
          ? "server_maintenance_enable"
          : "server_maintenance_disable",
        description: `${input.enabled ? "Enabled" : "Disabled"} maintenance on ${serverConfig.name}`,
        serverId: input.serverId,
      });

      try {
        const ws = await getService(Services.WEBSOCKET_SERVICE);
        await ws.triggerServerStatusUpdate(input.serverId);
      } catch {
        // Non-critical, UI will catch up on next poll
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

      try {
        const ws = await getService(Services.WEBSOCKET_SERVICE);
        await ws.triggerServerStatusUpdate(input.serverId);
      } catch {
        // Non-critical
      }

      await Q.admin.log.action.logAction({
        ...auditActor(ctx),
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
        ...auditActor(ctx),
        actionType: "server_maintenance_cancel",
        description: `Cancelled scheduled maintenance on ${serverConfig?.name ?? `server ${input.serverId}`}`,
        serverId: input.serverId,
      });

      try {
        const ws = await getService(Services.WEBSOCKET_SERVICE);
        await ws.triggerServerStatusUpdate(input.serverId);
      } catch {
        // Non-critical
      }

      return { cancelled: true };
    }),
};
