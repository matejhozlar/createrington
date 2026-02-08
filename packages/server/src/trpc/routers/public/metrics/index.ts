import { router } from "../../../trpc";
import { playtimeRouter } from "./playtime";

export const metricsRouter = router({
  playtime: playtimeRouter,
});
