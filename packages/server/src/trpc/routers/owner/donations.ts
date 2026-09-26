import { z } from "zod";
import { router, ownerProcedure } from "@/trpc/trpc";
import { Q, donationRepo } from "@/db";
import { getService, Services } from "@/services";
import config from "@/config";
import { paginateQuery, paginationInput } from "@/trpc/utils";

/** Owner donations router: paginated list and aggregate stats. */
export const ownerDonationsRouter = router({
  stats: ownerProcedure
    .meta({
      description:
        "Get aggregate donation statistics: total raised, unique donor count, and total donation count",
    })
    .query(async () => {
      return donationRepo.getStats();
    }),

  subscriptionStats: ownerProcedure
    .meta({
      description:
        "Get active subscription count, cancelling count, and monthly recurring revenue",
    })
    .query(async () => {
      if (!config.stripe.enabled) {
        return { activeCount: 0, cancellingCount: 0, mrrCents: 0 };
      }
      const donationService = await getService(Services.DONATION_SERVICE);
      return donationService.getSubscriptionStats();
    }),

  list: ownerProcedure
    .meta({
      description:
        "List all donations with optional status, type, and Discord ID filters, pagination, and newest-first ordering",
    })
    .input(
      z.object({
        status: z
          .enum(["pending", "completed", "refunded", "cancelled"])
          .optional(),
        type: z.enum(["one_time", "monthly"]).optional(),
        discordId: z.string().optional(),
        ...paginationInput(),
      }),
    )
    .query(async ({ input }) => {
      const { rows, pagination } = await paginateQuery(
        Q.donation,
        {
          status: input.status,
          type: input.type,
          playerDiscordId: input.discordId,
        },
        input,
        { orderBy: "createdAt", orderDirection: "desc" },
      );

      return {
        donations: rows.map((d) => ({
          id: d.id,
          playerDiscordId: d.playerDiscordId,
          type: d.type,
          amountCents: d.amountCents,
          currency: d.currency,
          status: d.status,
          stripeSessionId: d.stripeSessionId,
          stripeCustomerId: d.stripeCustomerId,
          stripeSubscriptionId: d.stripeSubscriptionId,
          supporterRoleGranted: d.supporterRoleGranted,
          createdAt: d.createdAt.toISOString(),
          completedAt: d.completedAt?.toISOString() ?? null,
        })),
        pagination,
      };
    }),
});
