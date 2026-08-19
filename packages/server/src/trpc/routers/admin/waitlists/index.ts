import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { waitlistRepo } from "@/db";
import { waitlistService } from "@/services/waitlist/waitlist.service";
import { escapeLike } from "@/db/utils";
import { paginationInput, buildPagination, rethrowTrpc } from "@/trpc/utils";
import type { WaitlistEntryFilters } from "@createrington/shared/db";

/** Admin waitlists router: stats, list, detail, promote, and delete waitlist entries. */
export const waitlistsRouter = router({
  stats: adminProcedure
    .meta({
      description: "Get overall waitlist statistics for the admin dashboard.",
    })
    .query(async () => {
      return await waitlistRepo.getStats();
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
          .enum(["queuedAt", "promotedAt", "discordUsername"])
          .default("queuedAt"),
        orderDirection: z.enum(["asc", "desc"]).default("desc"),
      }),
    )
    .query(async ({ input }) => {
      const filters: WaitlistEntryFilters = {};

      if (input.status) filters.status = input.status;
      if (input.discordUsername) {
        filters.discordUsername = {
          $ilike: `%${escapeLike(input.discordUsername)}%`,
        };
      }
      if (input.discordId) filters.discordId = input.discordId;

      const [entries, total] = await Promise.all([
        waitlistRepo.getAll(filters, {
          orderBy: input.orderBy,
          orderDirection: input.orderDirection,
          limit: input.limit,
          offset: input.page * input.limit,
        }),
        waitlistRepo.count(filters),
      ]);

      return {
        entries,
        pagination: buildPagination(input.page, input.limit, total),
      };
    }),

  get: adminProcedure
    .meta({
      description: "Get detailed information for a single waitlist entry.",
    })
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const entry = await waitlistRepo.getDetailed(input.id);

      return { entry };
    }),

  promote: adminProcedure
    .meta({
      description:
        "Force-promote a waitlist entry: the bot pings the member in their verification channel and they can register immediately",
    })
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      try {
        const entry = await waitlistService.promote(
          input.id,
          ctx.user.discordId,
        );

        return { entry };
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  delete: adminProcedure
    .meta({ description: "Delete a waitlist entry with a reason for audit" })
    .input(
      z.object({
        id: z.number().int().positive(),
        reason: z.string().min(1, "Reason is required"),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await waitlistRepo.adminDelete(
        input.id,
        ctx.user.discordId,
        ctx.user.minecraftUsername,
        input.reason,
      );

      return { message: "Waitlist entry deleted successfully" };
    }),
});
