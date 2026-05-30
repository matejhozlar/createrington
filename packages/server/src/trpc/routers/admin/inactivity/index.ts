import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import {
  buildPagination,
  paginationInput,
  trpcError,
  auditActor,
} from "@/trpc/utils";
import config from "@/config";
import { getService, getServiceSync, Services } from "@/services";
import { Discord } from "@/discord/constants";
import { EmbedPresets } from "@/discord/embeds";
import { DiscordMessageService } from "@/services/discord/message/message.service";
import { removeInactiveWarning } from "@/services/discord/cleanup/inactivity/remove-warning";
import type { InactivityCleanupService } from "@/services/discord/cleanup/inactivity/inactivity-cleanup.service";
import { ghostsRouter } from "./ghosts";

const GRACE_DAYS = 14;

const warningStatusSchema = z.enum([
  "all",
  "active",
  "expired",
  "resolved",
  "removed",
]);

/**
 * True when the inactivity cleanup service is registered and safe to
 * mutate against, i.e. we're running on the real production deployment.
 */
function isManualActionsEnabled(): boolean {
  return config.envMode.isProd && !config.envMode.isDevDeployment;
}

/** Admin inactivity router: list, stats, and manual resolve/remove/trigger. */
export const inactivityRouter = router({
  ghosts: ghostsRouter,
  capabilities: adminProcedure
    .meta({
      description:
        "Returns whether destructive actions (remove, trigger cleanup) are available in this environment",
    })
    .query(() => ({
      canMutate: isManualActionsEnabled(),
      graceDays: GRACE_DAYS,
    })),

  stats: adminProcedure
    .meta({
      description:
        "Counts of active/expired/resolved/removed inactivity warnings",
    })
    .query(async () => {
      const counts =
        await Q.player.inactivity.warning.countByStatus(GRACE_DAYS);
      return counts;
    }),

  list: adminProcedure
    .meta({
      description:
        "Paginated list of inactivity warnings filtered by status and optional username search",
    })
    .input(
      z.object({
        status: warningStatusSchema.default("all"),
        search: z.string().optional(),
        ...paginationInput({ defaultLimit: 20, maxLimit: 100 }),
      }),
    )
    .query(async ({ input }) => {
      const { warnings, total } =
        await Q.player.inactivity.warning.listByStatus({
          status: input.status,
          graceDays: GRACE_DAYS,
          search: input.search?.trim() || undefined,
          limit: input.limit,
          offset: input.page * input.limit,
        });

      return {
        warnings,
        pagination: buildPagination(input.page, input.limit, total),
      };
    }),

  resolveManual: adminProcedure
    .meta({
      description:
        "Manually resolve an inactivity warning (marks the player as returned)",
    })
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const warning = await Q.player.inactivity.warning.findByIdWithPlayer(
        input.id,
      );

      if (!warning) {
        throw trpcError.notFound("Warning not found");
      }

      if (warning.resolvedAt) {
        throw trpcError.conflict("Warning is already resolved");
      }

      if (warning.removedAt) {
        throw trpcError.conflict("Warning is already removed, cannot resolve");
      }

      await Q.player.inactivity.warning.resolveWarning(input.id);

      await Q.admin.log.action.logAction({
        ...auditActor(ctx),
        actionType: "inactivity_resolve_manual",
        description: `Manually resolved inactivity warning for ${
          warning.minecraftUsername ?? warning.playerMinecraftUuid
        }`,
      });

      return { message: "Warning resolved" };
    }),

  removeManual: adminProcedure
    .meta({
      description:
        "Manually run the removal sequence for an inactivity warning (kick, whitelist remove, player delete)",
    })
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      if (!isManualActionsEnabled()) {
        throw trpcError.forbidden(
          "Manual removal is only available on the production deployment",
        );
      }

      const warning = await Q.player.inactivity.warning.findByIdWithPlayer(
        input.id,
      );

      if (!warning) {
        throw trpcError.notFound("Warning not found");
      }

      if (warning.resolvedAt) {
        throw trpcError.conflict("Warning is already resolved");
      }

      if (warning.removedAt) {
        throw trpcError.conflict("Warning is already removed");
      }

      if (!warning.minecraftUsername || !warning.discordId) {
        throw trpcError.conflict(
          "Player record is missing, cannot perform manual removal",
        );
      }

      await removeInactiveWarning({
        id: warning.id,
        playerMinecraftUuid: warning.playerMinecraftUuid,
        minecraftUsername: warning.minecraftUsername,
        discordId: warning.discordId,
        warnedAt: warning.warnedAt,
      });

      try {
        const embed = EmbedPresets.inactivity.adminRemoval({
          players: [warning.minecraftUsername],
          triggeredBy: {
            discordId: ctx.user.discordId,
            username: ctx.user.minecraftUsername,
          },
          removedAt: new Date(),
        });

        const mainBot = getServiceSync(Services.DISCORD_MAIN_BOT);
        const messageService = DiscordMessageService.getInstance(mainBot);

        await messageService.send({
          channelId: Discord.Channels.administration.NOTIFICATIONS,
          embeds: embed.build(),
        });
      } catch (error) {
        logger.error(
          "Failed to send inactivity manual-removal admin notification:",
          error,
        );
      }

      await Q.admin.log.action.logAction({
        ...auditActor(ctx),
        actionType: "inactivity_remove_manual",
        description: `Manually removed inactive player ${warning.minecraftUsername}`,
      });

      return { message: "Player removed" };
    }),

  triggerCleanup: adminProcedure
    .meta({
      description:
        "Force-run the inactivity cleanup cycle now and reset the recurring schedule",
    })
    .mutation(async ({ ctx }) => {
      if (!isManualActionsEnabled()) {
        throw trpcError.forbidden(
          "Triggering the cleanup cycle is only available on the production deployment",
        );
      }

      let service: InactivityCleanupService;
      try {
        service = await getService(Services.INACTIVITY_CLEANUP_SERVICE);
      } catch {
        throw trpcError.internal("Inactivity cleanup service is not available");
      }

      await service.forceRunAndResetSchedule({
        discordId: ctx.user.discordId,
        username: ctx.user.minecraftUsername,
      });

      await Q.admin.log.action.logAction({
        ...auditActor(ctx),
        actionType: "inactivity_trigger_cleanup",
        description: "Force-triggered inactivity cleanup cycle",
      });

      return { message: "Cleanup cycle completed" };
    }),

  triggerResolveRemove: adminProcedure
    .meta({
      description:
        "Run only the resolve + remove phases now (no new warning announcements)",
    })
    .mutation(async ({ ctx }) => {
      if (!isManualActionsEnabled()) {
        throw trpcError.forbidden(
          "Processing overdue players is only available on the production deployment",
        );
      }

      let service: InactivityCleanupService;
      try {
        service = await getService(Services.INACTIVITY_CLEANUP_SERVICE);
      } catch {
        throw trpcError.internal("Inactivity cleanup service is not available");
      }

      await service.triggerResolveAndRemove({
        discordId: ctx.user.discordId,
        username: ctx.user.minecraftUsername,
      });

      await Q.admin.log.action.logAction({
        ...auditActor(ctx),
        actionType: "inactivity_trigger_resolve_remove",
        description:
          "Force-ran inactivity resolve+remove phases (no new warnings)",
      });

      return { message: "Overdue warnings processed" };
    }),
});
