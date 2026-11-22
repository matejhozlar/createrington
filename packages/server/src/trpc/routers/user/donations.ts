import { z } from "zod";
import { router, userProcedure } from "@/trpc/trpc";
import { trpcError } from "@/trpc/utils";
import { Q } from "@/db";
import { getOptionalService, Services } from "@/services";
import type { DonationService } from "@/services/donation/donation.service";
import { siteUrl } from "@/config/site-url";

const MIN_AMOUNT_CENTS = 100;
const MAX_AMOUNT_CENTS = 100_000;

async function requireDonationService(): Promise<DonationService> {
  const service = await getOptionalService(Services.DONATION_SERVICE);
  if (!service) {
    throw trpcError.preconditionFailed(
      "Donations are not available at this time",
    );
  }
  return service;
}

export const userDonationsRouter = router({
  createCheckout: userProcedure
    .meta({
      description:
        "Create a Stripe checkout session for a one-time or monthly donation. Returns the Stripe-hosted checkout URL",
    })
    .input(
      z.object({
        type: z.enum(["one_time", "monthly"]),
        amountCents: z
          .number()
          .int()
          .min(
            MIN_AMOUNT_CENTS,
            `Minimum donation is €${MIN_AMOUNT_CENTS / 100}`,
          )
          .max(
            MAX_AMOUNT_CENTS,
            `Maximum donation is €${MAX_AMOUNT_CENTS / 100}`,
          ),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const donationService = await requireDonationService();

      const { sessionId, url } = await donationService.createCheckoutSession({
        discordId: ctx.user.discordId,
        type: input.type,
        amountCents: input.amountCents,
        successUrl: `${siteUrl("/donate/success")}?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: siteUrl("/donate/cancel"),
      });

      return { sessionId, url };
    }),

  activeSubscription: userProcedure
    .meta({
      description:
        "Get the user's active monthly subscription details, or null if none",
    })
    .query(async ({ ctx }) => {
      const donationService = await getOptionalService(
        Services.DONATION_SERVICE,
      );
      return donationService
        ? donationService.getActiveSubscription(ctx.user.discordId)
        : null;
    }),

  cancelSubscription: userProcedure
    .meta({
      description:
        "Cancel the user's monthly subscription at the end of the current billing period",
    })
    .mutation(async ({ ctx }) => {
      const donationService = await requireDonationService();
      const result = await donationService.cancelSubscription(
        ctx.user.discordId,
      );

      if (!result) {
        throw trpcError.notFound("No active subscription found");
      }

      return { cancelAt: result.cancelAt.toISOString() };
    }),

  reactivateSubscription: userProcedure
    .meta({
      description:
        "Reactivate a cancelled subscription before the billing period ends",
    })
    .mutation(async ({ ctx }) => {
      const donationService = await requireDonationService();
      const success = await donationService.reactivateSubscription(
        ctx.user.discordId,
      );

      if (!success) {
        throw trpcError.notFound(
          "No cancelled subscription found to reactivate",
        );
      }
    }),

  history: userProcedure
    .meta({
      description:
        "Get the authenticated user's donation history, most recent first",
    })
    .query(async ({ ctx }) => {
      const donations = await Q.donation.findAll(
        { playerDiscordId: ctx.user.discordId },
        { orderBy: "createdAt", orderDirection: "desc" },
      );

      return donations.map((d) => ({
        id: d.id,
        type: d.type,
        amountCents: d.amountCents,
        currency: d.currency,
        status: d.status,
        createdAt: d.createdAt.toISOString(),
        completedAt: d.completedAt?.toISOString() ?? null,
      }));
    }),
});
