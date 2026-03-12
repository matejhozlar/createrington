import { router } from "@/trpc/trpc";
import { playtimeRouter } from "./playtime";

/** Public metrics router — playtime statistics available without auth. */
export const metricsRouter = router({
  playtime: playtimeRouter,
});
