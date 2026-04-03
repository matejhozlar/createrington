import { router, publicProcedure } from "@/trpc/trpc";
import { waitlist, waitlistRepo } from "@/db";
import { z } from "zod";
import { trpcError } from "@/trpc/utils";

/** Public waitlists router — check server capacity mode and register for waitlist. */
export const waitlistsRouter = router({
  status: publicProcedure
    .meta({
      description: "Check whether the server is in open or waitlist mode.",
    })
    .query(async () => {
      const hasCapacity = await waitlistRepo.hasCapacity();
      return { mode: hasCapacity ? ("open" as const) : ("waitlist" as const) };
    }),

  create: publicProcedure
    .meta({
      description:
        "Registers a new waitlist entry. In open mode (under player limit), auto-accepts and returns a token. In waitlist mode, requires email and goes to pending",
    })
    .input(
      z.object({
        discordName: z
          .string()
          .min(1, "Discord name is required")
          .max(100, "Discord name too long"),
        email: z.string().email("Invalid email format").optional(),
        metadata: z
          .record(
            z.string(),
            z.union([z.string(), z.number(), z.boolean(), z.null()]),
          )
          .optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { discordName, email, metadata } = input;

      const hasCapacity = await waitlistRepo.hasCapacity();

      if (!hasCapacity && !email) {
        throw trpcError.badRequest(
          "Email is required when the server is at capacity",
        );
      }

      if (email) {
        const [emailExists] = await waitlist.entry.findAll(
          { email },
          { limit: 1 },
        );
        if (emailExists) {
          throw trpcError.conflict("This email is already on the waitlist");
        }
      }

      const [discordExists] = await waitlist.entry.findAll(
        { discordName },
        { limit: 1 },
      );
      if (discordExists) {
        throw trpcError.conflict(
          "This Discord username is already on the waitlist",
        );
      }

      const result = await waitlistRepo.register({
        discordName,
        email: email || null,
        metadata: metadata || null,
      });

      if (result.autoAccepted && result.token) {
        return {
          entry: result.entry,
          status: "auto_accepted" as const,
          token: result.token,
          redirectUrl: `/invite/${encodeURIComponent(result.token)}`,
          message: "You've been accepted! Use the token below to join.",
        };
      } else {
        return {
          entry: result.entry,
          status: "pending" as const,
          message:
            "Thanks! We've added you to the waitlist. We'll contact you when a spot opens up.",
        };
      }
    }),
});
