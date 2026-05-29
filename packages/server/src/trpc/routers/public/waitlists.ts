import { router, publicProcedure } from "@/trpc/trpc";
import { waitlist, waitlistRepo } from "@/db";
import { waitlistCreateInputSchema } from "@createrington/shared/api";
import { trpcError } from "@/trpc/utils";
import { createRateLimit } from "@/trpc/middleware/rate-limit";

const waitlistCreateLimit = createRateLimit({
  name: "public.waitlists.create",
  limit: 5,
  windowMs: 60 * 60 * 1000,
  key: (ctx) => ctx.ip || "anon",
});

/** Public waitlists router: check server capacity mode and register for waitlist. */
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
    .use(waitlistCreateLimit)
    .meta({
      description:
        "Registers a new waitlist entry. In open mode (under player limit), auto-accepts and emails a Discord invite URL. In waitlist mode, requires Discord name + email and goes to pending.",
    })
    .input(waitlistCreateInputSchema)
    .mutation(async ({ input }) => {
      const { discordName, email, metadata } = input;

      const hasCapacity = await waitlistRepo.hasCapacity();

      if (!hasCapacity && !email) {
        throw trpcError.badRequest(
          "Email is required when the server is at capacity",
        );
      }

      if (!hasCapacity && !discordName) {
        throw trpcError.badRequest(
          "Discord username is required when the server is at capacity",
        );
      }

      // Returned for both duplicate email and duplicate discord name: distinct
      // responses would let an anonymous caller enumerate registrations.
      const alreadyRegistered = {
        entry: null,
        status: "already_registered" as const,
        message:
          "Thanks! You're already registered. We'll email you when a spot opens up.",
      };

      if (email) {
        const [emailExists] = await waitlist.entry.findAll(
          { email },
          { limit: 1 },
        );
        if (emailExists) {
          logger.info(`Waitlist duplicate email attempt`);
          return alreadyRegistered;
        }
      }

      if (discordName) {
        const [discordExists] = await waitlist.entry.findAll(
          { discordName },
          { limit: 1 },
        );
        if (discordExists) {
          logger.info(`Waitlist duplicate discord name attempt`);
          return alreadyRegistered;
        }
      }

      const result = await waitlistRepo.register({
        discordName: discordName ?? null,
        email: email ?? null,
        metadata: metadata || null,
      });

      if (result.autoAccepted && result.inviteUrl) {
        return {
          entry: result.entry,
          status: "auto_accepted" as const,
          inviteUrl: result.inviteUrl,
          message:
            "You're in! Click the button below to join our Discord server.",
        };
      } else {
        return {
          entry: result.entry,
          status: "pending" as const,
          message:
            "Thanks! We've added you to the waitlist. We'll email you when a spot opens up.",
        };
      }
    }),
});
