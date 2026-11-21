import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { playerAuditRepo } from "@/db";
import {
  paginationInput,
  buildPagination,
  playerId,
  pageOffset,
} from "@/trpc/utils";

export const auditRouter = router({
  list: adminProcedure
    .meta({ description: "Get the admin action audit log for a player" })
    .input(
      z.object({
        id: playerId(),
        ...paginationInput({ maxLimit: 200, defaultLimit: 50 }),
      }),
    )
    .query(async ({ input }) => {
      const [auditLog, total] = await Promise.all([
        playerAuditRepo.getLog(input.id, input.limit, pageOffset(input)),
        playerAuditRepo.count(input.id),
      ]);

      return {
        items: auditLog,
        pagination: buildPagination(input.page, input.limit, total),
      };
    }),
});
