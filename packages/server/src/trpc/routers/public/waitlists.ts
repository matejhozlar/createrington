import { router, publicProcedure } from "@/trpc/trpc";
import { waitlistRepo } from "@/db";

/** Public waitlists router: check whether intake is open or waitlisted. */
export const waitlistsRouter = router({
  status: publicProcedure
    .meta({
      description: "Check whether the server is in open or waitlist mode.",
    })
    .query(async () => {
      const hasCapacity = await waitlistRepo.hasCapacityMemoized();
      return { mode: hasCapacity ? ("open" as const) : ("waitlist" as const) };
    }),
});
