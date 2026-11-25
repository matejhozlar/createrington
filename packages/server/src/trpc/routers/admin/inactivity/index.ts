import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import {
  buildPagination,
  findOrThrow,
  paginationInput,
  trpcError,
  auditActor,
  id,
  pageOffset,
} from "@/trpc/utils";
import config from "@/config";
import { getOptionalService, Services } from "@/services";
import { Discord } from "@/discord/constants";
import { EmbedPresets } from "@/discord/embeds";
import { removeInactiveWarning } from "@/services/discord/cleanup/inactivity/remove-warning";
import type { InactivityCleanupService } from "@/services/discord/cleanup/inactivity/inactivity-cleanup.service";
import {
  INACTIVITY_GRACE_DAYS,
  INACTIVITY_RETENTION_DAYS,
} from "@/services/discord/cleanup/inactivity/constants";
import { ghostsRouter } from "./ghosts";
import { unlinkedRouter } from "./unlinked";
import { exemptionsRouter } from "./exemptions";

const warningStatusSchema = z.enum([
  "all",
  "active",
  "expired",
  "resolved",
  "removed",
]);

function isManualActionsEnabled(): boolean {
  return config.envMode.isProductionDeployment;
}

async function getCleanupService(
  notConfiguredMessage: string,
): Promise<InactivityCleanupService> {
  let service: InactivityCleanupService | null;
  try {
    service = await getOptionalService(Services.INACTIVITY_CLEANUP_SERVICE);
  } catch {
    throw trpcError.internal("Inactivity cleanup service is not available");
  }
  if (!service) {
    throw trpcError.forbidden(notConfiguredMessage);
  }
  return service;
}

export const inactivityRouter = router({
  ghosts: ghostsRouter,
  unlinked: unlinkedRouter,
  exemptions: exemptionsRouter,
  capabilities: adminProcedure
    .meta({
      description:
        "Returns whether destructive actions (remove, trigger cleanup) are available in this environment",
    })
    .query(() => ({
      canMutate: isManualActionsEnabled(),
      graceDays: INACTIVITY_GRACE_DAYS,
      retentionDays: INACTIVITY_RETENTION_DAYS,
    })),

  stats: adminProcedure
    .meta({
      description:
        "Counts of active/expired inactivity warnings, plus resolved/removed within the retention window",
    })
    .query(async () => {
      const counts = await Q.player.inactivity.warning.countByStatus(
        INACTIVITY_GRACE_DAYS,
        INACTIVITY_RETENTION_DAYS,
      );
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
      const { rows, total } = await Q.player.inactivity.warning.getByStatus({
        status: input.status,
        graceDays: INACTIVITY_GRACE_DAYS,
        search: input.search?.trim() || undefined,
        limit: input.limit,
        offset: pageOffset(input),
      });

      return {
        items: rows,
        pagination: buildPagination(input.page, input.limit, total),
      };
    }),

  resolveManual: adminProcedure
    .meta({
      description:
        "Manually resolve an inactivity warning (marks the player as returned)",
    })
    .input(z.object({ id: id() }))
    .mutation(async ({ input, ctx }) => {
      const warning = await findOrThrow(
        Q.player.inactivity.warning.findByIdWithPlayer(input.id),
        "Warning not found",
      );

      if (warning.resolvedAt) {
        throw trpcError.conflict("Warning is already resolved");
      }

      if (warning.removedAt) {
        throw trpcError.conflict("Warning is already removed, cannot resolve");
      }

      await Q.player.inactivity.warning.update(
        { id: input.id },
        { resolvedAt: new Date() },
      );

      await Q.admin.log.action.logAction({
        ...auditActor(ctx),
        actionType: "inactivity_resolve_manual",
        description: `Manually resolved inactivity warning for ${
          warning.minecraftUsername ?? warning.playerMinecraftUuid
        }`,
      });
    }),

  removeManual: adminProcedure
    .meta({
      description:
        "Manually run the removal sequence for an inactivity warning (kick, whitelist remove, player delete)",
    })
    .input(z.object({ id: id() }))
    .mutation(async ({ input, ctx }) => {
      if (!isManualActionsEnabled()) {
        throw trpcError.forbidden(
          "Manual removal is only available on the production deployment",
        );
      }

      const warning = await findOrThrow(
        Q.player.inactivity.warning.findByIdWithPlayer(input.id),
        "Warning not found",
      );

      if (warning.resolvedAt) {
        throw trpcError.conflict("Warning is already resolved");
      }

      if (warning.removedAt) {
        throw trpcError.conflict("Warning is already removed");
      }

      if (
        !warning.playerMinecraftUuid ||
        !warning.minecraftUsername ||
        !warning.discordId
      ) {
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

        await Discord.Messages.send({
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
    }),

  triggerCleanup: adminProcedure
    .meta({
      description:
        "Force-run the inactivity cleanup cycle now and reset the recurring schedule",
    })
    .mutation(async ({ ctx }) => {
      const service = await getCleanupService(
        "Triggering the cleanup cycle is only available on the production deployment",
      );

      await service.forceRunAndResetSchedule({
        discordId: ctx.user.discordId,
        username: ctx.user.minecraftUsername,
      });

      await Q.admin.log.action.logAction({
        ...auditActor(ctx),
        actionType: "inactivity_trigger_cleanup",
        description: "Force-triggered inactivity cleanup cycle",
      });
    }),

  triggerResolveRemove: adminProcedure
    .meta({
      description:
        "Run only the resolve + remove phases now (no new warning announcements)",
    })
    .mutation(async ({ ctx }) => {
      const service = await getCleanupService(
        "Processing overdue players is only available on the production deployment",
      );

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
    }),
});
