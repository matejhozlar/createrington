import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, userProcedure } from "@/trpc/trpc";
import { donationRepo } from "@/db";
import { getService, Services } from "@/services";
import config from "@/config";

const MIN_AMOUNT_CENTS = 100;
const MAX_AMOUNT_CENTS = 100_000;

/** User donations router — create Stripe checkout session and view donation history. */
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
      if (!config.stripe.enabled) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Donations are not available at this time",
        });
      }
      const donationService = await getService(Services.DONATION_SERVICE);
      const baseUrl = config.meta.links.website;

      const { sessionId, url } = await donationService.createCheckoutSession({
        discordId: ctx.user.discordId,
        type: input.type,
        amountCents: input.amountCents,
        successUrl: `${baseUrl}/donate/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${baseUrl}/donate/cancel`,
      });

      return { sessionId, url };
    }),

  history: userProcedure
    .meta({
      description:
        "Get the authenticated user's donation history, most recent first",
    })
    .query(async ({ ctx }) => {
      const donations = await donationRepo.findByDiscordId(ctx.user.discordId);

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
