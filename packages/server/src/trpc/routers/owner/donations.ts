import { z } from "zod";
import { router, ownerProcedure } from "@/trpc/trpc";
import { donationRepo } from "@/db";
import { getService, Services } from "@/services";
import config from "@/config";
import { paginationInput } from "@/trpc/utils";

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
        "List all donations with optional status filter, pagination, and newest-first ordering",
    })
    .input(
      z.object({
        status: z
          .enum(["pending", "completed", "refunded", "cancelled"])
          .optional(),
        discordId: z.string().optional(),
        ...paginationInput(),
      }),
    )
    .query(async ({ input }) => {
      const limit = input.limit;
      const offset = input.page * input.limit;

      const [all, total] = await Promise.all([
        donationRepo.listAll({ limit: limit + 1, offset }),
        donationRepo.count(),
      ]);

      const filtered = input.status
        ? all.filter((d) => d.status === input.status)
        : all;
      const byDiscord = input.discordId
        ? filtered.filter((d) => d.playerDiscordId === input.discordId)
        : filtered;

      const hasNextPage = byDiscord.length > limit;
      const items = hasNextPage ? byDiscord.slice(0, limit) : byDiscord;

      return {
        donations: items.map((d) => ({
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
        pagination: {
          page: input.page,
          limit,
          hasNextPage,
          total,
        },
      };
    }),
});
