import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import {
  buildPagination,
  paginationInput,
  rethrowTrpc,
  trpcError,
} from "@/trpc/utils";
import config from "@/config";
import { getService, getServiceSync, Services } from "@/services";
import { Discord } from "@/discord/constants";
import { EmbedPresets } from "@/discord/embeds";
import { DiscordMessageService } from "@/services/discord/message/message.service";
import type { GhostMemberService } from "@/services/discord/cleanup/ghost/ghost-member.service";

/**
 * True when the inactivity cleanup service is registered and safe to
 * mutate against, i.e. we're running on the real production deployment.
 *
 * Mirrors the gate used by the inactivity removeManual procedure so the
 * ghost-removal action has the same destructive-action policy.
 */
function isManualActionsEnabled(): boolean {
  return config.envMode.isProd && !config.envMode.isDevDeployment;
}

async function getGhostService(): Promise<GhostMemberService> {
  try {
    return await getService(Services.GHOST_MEMBER_SERVICE);
  } catch {
    throw trpcError.internal("Ghost member service is not available");
  }
}

/**
 * Admin sub-router for the "Members Missing from Discord" tool.
 *
 * The list is an in-memory cache populated only by explicit refresh
 * (no auto-runs, no persistence). The destructive remove action is
 * gated to the real prod deployment, matching the inactivity tool.
 */
export const ghostsRouter = router({
  capabilities: adminProcedure
    .meta({
      description:
        "Returns whether ghost removal is available in this environment, plus the last-refreshed timestamp",
    })
    .query(async () => {
      const service = await getGhostService();
      return {
        canMutate: isManualActionsEnabled(),
        lastRefreshedAt: service.getLastRefreshedAt(),
      };
    }),

  list: adminProcedure
    .meta({
      description:
        "Paginated list of registered players currently missing from the Discord guild (cache only)",
    })
    .input(
      z.object({
        search: z.string().optional(),
        ...paginationInput({ defaultLimit: 20, maxLimit: 100 }),
      }),
    )
    .query(async ({ input }) => {
      const service = await getGhostService();
      const { items, total } = service.list({
        page: input.page,
        limit: input.limit,
        search: input.search?.trim() || undefined,
      });

      return {
        items,
        pagination: buildPagination(input.page, input.limit, total),
        lastRefreshedAt: service.getLastRefreshedAt(),
      };
    }),

  refresh: adminProcedure
    .meta({
      description:
        "Rebuilds the ghost-member cache from the current guild member list and player table",
    })
    .mutation(async ({ ctx }) => {
      const service = await getGhostService();
      const result = await service.refresh();

      await Q.admin.log.action.logAction({
        adminDiscordId: ctx.user.discordId,
        adminUsername: ctx.user.minecraftUsername,
        actionType: "ghost_members_refresh",
        description: `Refreshed ghost member cache (${result.count} ghost(s))`,
      });

      return result;
    }),

  verify: adminProcedure
    .meta({
      description:
        "Re-checks a single user against Discord. Mutation (not query) because it mutates the cache: if the user has rejoined, they're evicted",
    })
    .input(z.object({ discordId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const service = await getGhostService();
      return service.verify(input.discordId);
    }),

  remove: adminProcedure
    .meta({
      description:
        "Remove a ghost member: re-verify, RCON whitelist remove on all servers, delete player record",
    })
    .input(z.object({ discordId: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      if (!isManualActionsEnabled()) {
        throw trpcError.forbidden(
          "Ghost removal is only available on the production deployment",
        );
      }

      const service = await getGhostService();

      let result: { minecraftUuid: string; minecraftUsername: string };
      try {
        result = await service.remove(input.discordId);
      } catch (error) {
        rethrowTrpc(error);
      }

      try {
        const embed = EmbedPresets.ghost.adminRemoval({
          target: {
            discordId: input.discordId,
            minecraftUsername: result.minecraftUsername,
          },
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
          "Failed to send ghost-member removal admin notification:",
          error,
        );
      }

      await Q.admin.log.action.logAction({
        adminDiscordId: ctx.user.discordId,
        adminUsername: ctx.user.minecraftUsername,
        actionType: "ghost_members_remove",
        description: `Removed ghost player ${result.minecraftUsername}`,
        targetPlayerUuid: result.minecraftUuid,
        targetPlayerName: result.minecraftUsername,
      });

      return { message: "Ghost member removed" };
    }),
});
