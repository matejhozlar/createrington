import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { waitlistRepo } from "@/db";
import { escapeLike } from "@/db/utils";
import { paginationInput, buildPagination } from "@/trpc/utils";
import type { WaitlistEntryFilters } from "@createrington/shared/db";

/** Admin waitlists router — stats, list, detail, invite, and delete waitlist entries. */
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
        "List waitlist entries with filtering by status, email, Discord name/ID, verified/registered status, plus pagination and sorting",
    })
    .input(
      z.object({
        status: z
          .enum([
            "pending",
            "auto_accepted",
            "accepted",
            "declined",
            "completed",
          ])
          .optional(),
        email: z.string().optional(),
        discordName: z.string().optional(),
        discordId: z.string().optional(),
        verified: z.boolean().optional(),
        registered: z.boolean().optional(),
        ...paginationInput(),
        orderBy: z
          .enum(["submittedAt", "acceptedAt", "email", "discordName"])
          .default("submittedAt"),
        orderDirection: z.enum(["asc", "desc"]).default("desc"),
      }),
    )
    .query(async ({ input }) => {
      const filters: WaitlistEntryFilters = {};

      if (input.status) filters.status = input.status;
      if (input.email)
        filters.email = { $ilike: `%${escapeLike(input.email)}%` };
      if (input.discordName) {
        filters.discordName = { $ilike: `%${escapeLike(input.discordName)}%` };
      }
      if (input.discordId) filters.discordId = input.discordId;
      if (input.verified !== undefined) filters.verified = input.verified;
      if (input.registered !== undefined) filters.registered = input.registered;

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

  invite: adminProcedure
    .meta({ description: "Manually invite/accept a waitlist entry" })
    .input(
      z.object({
        id: z.number().int().positive(),
        reason: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const updatedEntry = await waitlistRepo.manualInvite(
        input.id,
        ctx.user.discordId,
      );

      return { entry: updatedEntry };
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
