import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../../trpc";
import { waitlist, waitlistRepo } from "@/db";
import { CreateWaitlistEntryBodySchema } from "@createrington/shared/api/public/waitlists";

export const waitlistsRouter = router({
  create: publicProcedure
    .meta({
      description:
        "Registers a new waitlist entry. Checks for duplicate email/Discord name (throws CONFLICT). If auto-invite is enabled and spots are available, returns a token and redirect URL; otherwise returns a pending message.",
    })
    .input(CreateWaitlistEntryBodySchema)
    .mutation(async ({ input }) => {
      const { email, discordName } = input;

      const emailExists = await waitlist.entry.find({ email });
      if (emailExists) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This email is already on the waitlist",
        });
      }

      const discordExists = await waitlist.entry.find({ discordName });
      if (discordExists) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This Discord username is already on the waitlist",
        });
      }

      const result = await waitlistRepo.register({
        email,
        discordName,
      });

      if (result.autoInvited && result.token) {
        return {
          entry: result.entry,
          autoInvited: true as const,
          token: result.token,
          redirectUrl: `/invite/${encodeURIComponent(result.token)}`,
          message:
            "You were auto-invited. Check your email address for the invite link.",
        };
      } else {
        return {
          entry: result.entry,
          autoInvited: false as const,
          message:
            "Thanks! We've added you to the waitlist. We'll contact you when a spot opens up.",
        };
      }
    }),
});
