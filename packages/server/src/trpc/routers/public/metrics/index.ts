import { router } from "@/trpc/trpc";
import { playtimeRouter } from "./playtime";

export const metricsRouter = router({
  playtime: playtimeRouter,
});
