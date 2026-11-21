import { z } from "zod";
import { ADMIN_REASON_MAX_LENGTH } from "@createrington/shared/admin-reason";
import { router, adminProcedure } from "@/trpc/trpc";
import { Q, waitlistRepo } from "@/db";
import { waitlistPromotionService } from "@/services/waitlist/promotion.service";
import { ilikeContains } from "@/db/utils";
import {
  paginationInput,
  paginateQuery,
  sortDirection,
  id,
} from "@/trpc/utils";
import type { WaitlistEntryFilters } from "@createrington/shared/db";

export const waitlistsRouter = router({
  stats: adminProcedure
    .meta({
      description: "Get overall waitlist statistics for the admin dashboard.",
    })
    .query(async () => {
      return await Q.waitlist.entry.getFunnelStats();
    }),

  list: adminProcedure
    .meta({
      description:
        "List waitlist entries with filtering by status and Discord username/ID, plus pagination and sorting",
    })
    .input(
      z.object({
        status: z
          .enum(["queued", "promoted", "registered", "expired"])
          .optional(),
        discordUsername: z.string().optional(),
        discordId: z.string().optional(),
        ...paginationInput(),
        orderBy: z
          .enum(["createdAt", "queuedAt", "promotedAt", "discordUsername"])
          .default("queuedAt"),
        orderDirection: sortDirection().default("desc"),
      }),
    )
    .query(async ({ input }) => {
      const filters: WaitlistEntryFilters = {};

      if (input.status) filters.status = input.status;
      if (input.discordUsername) {
        filters.discordUsername = ilikeContains(input.discordUsername);
      }
      if (input.discordId) filters.discordId = input.discordId;

      const { rows: entries, pagination } = await paginateQuery(
        Q.waitlist.entry,
        filters,
        input,
        { orderBy: input.orderBy, orderDirection: input.orderDirection },
      );

      return { items: entries, pagination };
    }),

  get: adminProcedure
    .meta({
      description: "Get detailed information for a single waitlist entry.",
    })
    .input(z.object({ id: id() }))
    .query(async ({ input }) => {
      const entry = await Q.waitlist.entry.get({ id: input.id });

      return { entry };
    }),

  promote: adminProcedure
    .meta({
      description:
        "Force-promote a waitlist entry: the bot pings the member in their verification channel and they can register immediately",
    })
    .input(z.object({ id: id() }))
    .mutation(async ({ input, ctx }) => {
      return await waitlistPromotionService.promote(
        input.id,
        ctx.user.discordId,
      );
    }),

  delete: adminProcedure
    .meta({ description: "Delete a waitlist entry with a reason for audit" })
    .input(
      z.object({
        id: id(),
        reason: z
          .string()
          .min(1, "Reason is required")
          .max(ADMIN_REASON_MAX_LENGTH),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await waitlistRepo.adminDelete(
        input.id,
        ctx.user.discordId,
        ctx.user.minecraftUsername,
        input.reason,
      );

      void waitlistPromotionService.promoteEligible().catch((error) => {
        logger.error("Promotion pass after waitlist delete failed:", error);
      });
    }),
});
