import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import {
  buildPagination,
  paginationInput,
  trpcError,
  auditActor,
} from "@/trpc/utils";
import { getService, Services } from "@/services";
import type { UnlinkedMemberService } from "@/services/discord/cleanup/unlinked/unlinked-member.service";

async function getUnlinkedService(): Promise<UnlinkedMemberService> {
  try {
    return await getService(Services.UNLINKED_MEMBER_SERVICE);
  } catch {
    throw trpcError.internal("Unlinked member service is not available");
  }
}

/**
 * Admin sub-router for the "Members Missing from Database" tool.
 *
 * The inverse of the ghosts tool: onboarded Discord members with no matching
 * player record. The list is an in-memory cache populated only by explicit
 * refresh (no auto-runs, no persistence). Read-only: there is no player record
 * to remove, so no destructive action is exposed.
 */
export const unlinkedRouter = router({
  list: adminProcedure
    .meta({
      description:
        "Paginated list of onboarded Discord members with no matching player record (cache only)",
    })
    .input(
      z.object({
        search: z.string().optional(),
        ...paginationInput({ defaultLimit: 20, maxLimit: 100 }),
      }),
    )
    .query(async ({ input }) => {
      const service = await getUnlinkedService();
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
        "Rebuilds the unlinked-member cache from the current guild member list and player table",
    })
    .mutation(async ({ ctx }) => {
      const service = await getUnlinkedService();
      const result = await service.refresh();

      await Q.admin.log.action.logAction({
        ...auditActor(ctx),
        actionType: "unlinked_members_refresh",
        description: `Refreshed unlinked member cache (${result.count} member(s))`,
      });

      return result;
    }),
});
