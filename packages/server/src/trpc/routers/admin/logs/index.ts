import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import { paginationInput, buildPagination } from "@/trpc/utils";

/** Admin audit logs router — filterable, paginated admin action history. */
export const logsRouter = router({
  list: adminProcedure
    .meta({
      description:
        "List admin audit log entries with filtering, pagination, and sorting",
    })
    .input(
      z.object({
        ...paginationInput({ defaultLimit: 20 }),
        search: z.string().optional(),
        actionType: z.string().optional(),
        adminUsername: z.string().optional(),
        orderBy: z
          .enum(["performedAt", "actionType", "adminUsername"])
          .default("performedAt"),
        orderDirection: z.enum(["asc", "desc"]).default("desc"),
      }),
    )
    .query(async ({ input }) => {
      const { actions, total } = await Q.admin.log.action.search({
        search: input.search,
        actionType: input.actionType,
        adminUsername: input.adminUsername,
        orderBy: input.orderBy,
        orderDirection: input.orderDirection,
        limit: input.limit,
        offset: input.page * input.limit,
      });

      return {
        actions,
        pagination: buildPagination(input.page, input.limit, total),
      };
    }),
});
