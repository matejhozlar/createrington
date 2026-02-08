import { z } from "zod";
import { router, adminProcedure } from "../../../trpc";
import { Q } from "@/db";
import { paginationInput, buildPagination } from "../../../utils";
import type { AdminLogActionFilters } from "@createrington/shared/db/admin_log_action.types";

export const logsRouter = router({
  list: adminProcedure
    .meta({
      description:
        "List admin audit log entries with filtering, pagination, and sorting.",
    })
    .input(
      z.object({
        ...paginationInput({ defaultLimit: 20 }),
        search: z.string().optional(),
        actionType: z.string().optional(),
        tableName: z.string().optional(),
        adminDiscordUsername: z.string().optional(),
        orderBy: z
          .enum([
            "performedAt",
            "actionType",
            "tableName",
            "adminDiscordUsername",
          ])
          .default("performedAt"),
        orderDirection: z.enum(["asc", "desc"]).default("desc"),
      }),
    )
    .query(async ({ input }) => {
      const filters: AdminLogActionFilters = {};

      if (input.search) {
        filters.targetPlayerName = { $ilike: `%${input.search}%` };
      }
      if (input.actionType) filters.actionType = input.actionType;
      if (input.tableName) filters.tableName = input.tableName;
      if (input.adminDiscordUsername) {
        filters.adminDiscordUsername = {
          $ilike: `%${input.adminDiscordUsername}%`,
        };
      }

      const [actions, total] = await Promise.all([
        Q.admin.log.action.findAll(filters, {
          orderBy: input.orderBy,
          orderDirection: input.orderDirection,
          limit: input.limit,
          offset: input.page * input.limit,
        }),
        Q.admin.log.action.count(filters),
      ]);

      return {
        actions,
        pagination: buildPagination(input.page, input.limit, total),
      };
    }),
});
