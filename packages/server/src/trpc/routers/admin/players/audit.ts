import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { playerAuditRepo } from "@/db";
import { parsePlayerId, paginationInput, buildPagination } from "@/trpc/utils";

export const auditRouter = router({
  list: adminProcedure
    .meta({ description: "Get the admin action audit log for a player" })
    .input(
      z.object({
        id: z.string().min(1),
        ...paginationInput({ maxLimit: 200, defaultLimit: 50 }),
      }),
    )
    .query(async ({ input }) => {
      const identifier = parsePlayerId(input.id);

      const [auditLog, total] = await Promise.all([
        playerAuditRepo.getLog(
          identifier,
          input.limit,
          input.page * input.limit,
        ),
        playerAuditRepo.count(identifier),
      ]);

      return {
        actions: auditLog,
        pagination: buildPagination(input.page, input.limit, total),
      };
    }),
});
