import { router, publicProcedure } from "@/trpc/trpc";
import { waitlistCapacityService } from "@/services/waitlist/capacity.service";

export const waitlistsRouter = router({
  status: publicProcedure
    .meta({
      description: "Check whether the server is in open or waitlist mode.",
    })
    .query(async () => {
      const hasCapacity = await waitlistCapacityService.hasCapacityMemoized();
      return { mode: hasCapacity ? ("open" as const) : ("waitlist" as const) };
    }),
});
