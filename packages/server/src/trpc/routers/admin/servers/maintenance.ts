import { z } from "zod";
import { adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import { getService, Services } from "@/services";
import { maintenanceService } from "@/services/maintenance";
import { getServerById } from "@/services/playtime/config";
import { trpcError, auditActor } from "@/trpc/utils";
import { Discord } from "@/discord/constants";
import { EmbedPresets } from "@/discord/embeds";

const serverIdInput = z.object({
  serverId: z.coerce.number().int().positive(),
});

const MOTD_MAX_LENGTH = 300;
const MESSAGE_MAX_LENGTH = 600;

function requireServer(serverId: number) {
  const serverConfig = getServerById(serverId);
  if (!serverConfig) {
    throw trpcError.badRequest(`Server with id ${serverId} not found`);
  }
  return serverConfig;
}

async function broadcastStatus(serverId: number) {
  try {
    const ws = await getService(Services.WEBSOCKET_SERVICE);
    await ws.triggerServerStatusUpdate(serverId);
  } catch {
    return;
  }
}

function toScheduleView(
  schedule: ReturnType<typeof maintenanceService.getScheduledMaintenance>,
) {
  return schedule
    ? {
        id: schedule.id,
        scheduledAt: schedule.scheduledAt.toISOString(),
        estimatedMinutes: schedule.estimatedMinutes,
        status: schedule.status as "scheduled" | "active",
        untilRestart: schedule.untilRestart,
      }
    : null;
}

export const serverMaintenanceProcedures = {
  maintenanceStatus: adminProcedure
    .meta({ description: "Get maintenance mode status for a server" })
    .input(serverIdInput)
    .query(({ input }) => {
      const status = maintenanceService.getStatus(input.serverId);
      return {
        enabled: status.enabled,
        modEnabled: status.modEnabled,
        observedAt: status.observedAt?.toISOString() ?? null,
        pendingApply: status.pendingApply,
        schedule: toScheduleView(status.schedule),
      };
    }),

  toggleMaintenance: adminProcedure
    .meta({
      description:
        "Toggle maintenance mode for a server through the Maintenance Mode mod over RCON",
    })
    .input(
      serverIdInput.extend({
        enabled: z.boolean(),
        announce: z.boolean().optional().default(false),
        untilRestart: z.boolean().optional().default(false),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const serverConfig = requireServer(input.serverId);
      let applied = true;

      try {
        if (input.enabled) {
          ({ applied } = await maintenanceService.enable(input.serverId, {
            byDiscordId: ctx.user.discordId,
            untilRestart: input.untilRestart,
          }));
        } else {
          await maintenanceService.disable(input.serverId);

          if (input.announce) {
            try {
              const embed = EmbedPresets.announcements.maintenanceEnded();
              await Discord.Messages.send({
                channelId: Discord.Channels.createringtonOfficial.ANNOUNCEMENTS,
                embeds: embed.build(),
              });
            } catch (error) {
              logger.warn(
                `Failed to send maintenance ended announcement: ${error}`,
              );
            }
          }
        }
      } catch (error) {
        throw trpcError.internal(
          error instanceof Error
            ? error.message
            : "Failed to toggle maintenance",
        );
      }

      await Q.admin.log.action.logAction({
        ...auditActor(ctx),
        actionType: input.enabled
          ? "server_maintenance_enable"
          : "server_maintenance_disable",
        description: `${input.enabled ? "Enabled" : "Disabled"} maintenance on ${serverConfig.name}${
          input.enabled && input.untilRestart ? " (until restart)" : ""
        }${input.enabled && !applied ? " (server unreachable, pending)" : ""}`,
        serverId: input.serverId,
      });

      return { enabled: input.enabled, applied };
    }),

  scheduleMaintenance: adminProcedure
    .meta({
      description:
        "Schedule maintenance for a future time. Sends initial Discord announcement and sets up warning timers",
    })
    .input(
      serverIdInput.extend({
        type: z.enum(["maintenance", "modpack_update"]).default("maintenance"),
        scheduledAt: z.string().datetime({ offset: true }),
        estimatedMinutes: z.number().int().min(1).max(10080),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const serverConfig = requireServer(input.serverId);

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
      } catch (error) {
        logger.warn(`Failed to send maintenance announcement: ${error}`);
      }

      await broadcastStatus(input.serverId);

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
    .input(serverIdInput)
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

      await broadcastStatus(input.serverId);

      return { cancelled: true };
    }),

  maintenanceSettings: adminProcedure
    .meta({
      description:
        "Maintenance MOTD, kick message, presets, and the resolved allow list for a server",
    })
    .input(serverIdInput)
    .query(async ({ input }) => {
      requireServer(input.serverId);
      return maintenanceService.getSettings(input.serverId);
    }),

  updateMaintenanceSettings: adminProcedure
    .meta({
      description:
        "Update the maintenance MOTD and kick message (null restores the preset) and push them to the mod",
    })
    .input(
      serverIdInput.extend({
        motd: z.string().trim().min(1).max(MOTD_MAX_LENGTH).nullable(),
        message: z.string().trim().min(1).max(MESSAGE_MAX_LENGTH).nullable(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const serverConfig = requireServer(input.serverId);

      const { pushed } = await maintenanceService.updateSettings(
        input.serverId,
        { motd: input.motd, message: input.message },
        ctx.user.discordId,
      );

      await Q.admin.log.action.logAction({
        ...auditActor(ctx),
        actionType: "server_maintenance_settings_update",
        description: `Updated maintenance presentation on ${serverConfig.name}`,
        serverId: input.serverId,
        metadata: {
          motd: input.motd,
          message: input.message,
          pushed,
        },
      });

      return { pushed };
    }),

  addMaintenanceAllowedPlayer: adminProcedure
    .meta({
      description:
        "Allow a registered player to join during maintenance and push it to the mod",
    })
    .input(serverIdInput.extend({ playerUuid: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const serverConfig = requireServer(input.serverId);

      let result: { username: string; pushed: boolean };
      try {
        result = await maintenanceService.addAllowedPlayer(
          input.serverId,
          input.playerUuid,
          ctx.user.discordId,
        );
      } catch (error) {
        throw trpcError.badRequest(
          error instanceof Error ? error.message : "Failed to allow player",
        );
      }

      await Q.admin.log.action.logAction({
        ...auditActor(ctx),
        actionType: "server_maintenance_allow_player",
        description: `Allowed ${result.username} to join ${serverConfig.name} during maintenance`,
        serverId: input.serverId,
        targetPlayerUuid: input.playerUuid,
        targetPlayerName: result.username,
      });

      return result;
    }),

  removeMaintenanceAllowedPlayer: adminProcedure
    .meta({
      description:
        "Remove a manually allowed player from the maintenance allow list and push it to the mod",
    })
    .input(serverIdInput.extend({ playerUuid: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const serverConfig = requireServer(input.serverId);

      let result: { username: string; pushed: boolean };
      try {
        result = await maintenanceService.removeAllowedPlayer(
          input.serverId,
          input.playerUuid,
        );
      } catch (error) {
        throw trpcError.badRequest(
          error instanceof Error ? error.message : "Failed to remove player",
        );
      }

      await Q.admin.log.action.logAction({
        ...auditActor(ctx),
        actionType: "server_maintenance_disallow_player",
        description: `Removed ${result.username} from the maintenance allow list on ${serverConfig.name}`,
        serverId: input.serverId,
        targetPlayerUuid: input.playerUuid,
        targetPlayerName: result.username,
      });

      return result;
    }),

  pushMaintenanceSettings: adminProcedure
    .meta({
      description:
        "Push the stored maintenance MOTD, kick message, and allow list to the mod and re-read its state",
    })
    .input(serverIdInput)
    .mutation(async ({ input, ctx }) => {
      const serverConfig = requireServer(input.serverId);

      let sync: { added: string[]; removed: string[] };
      try {
        sync = await maintenanceService.pushSettings(input.serverId);
      } catch (error) {
        throw trpcError.internal(
          error instanceof Error
            ? error.message
            : "Failed to push maintenance settings",
        );
      }
      await maintenanceService.reconcile(input.serverId);

      await Q.admin.log.action.logAction({
        ...auditActor(ctx),
        actionType: "server_maintenance_settings_push",
        description: `Pushed maintenance settings to ${serverConfig.name} (+${sync.added.length} / -${sync.removed.length} allowed)`,
        serverId: input.serverId,
        metadata: sync,
      });

      return sync;
    }),
};
