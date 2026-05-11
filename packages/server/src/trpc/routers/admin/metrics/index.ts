import { router } from "@/trpc/trpc";
import { economyMetricsRouter } from "./economy";
import { activityMetricsRouter } from "./activity";
import { moderationMetricsRouter } from "./moderation";
import { growthMetricsRouter } from "./growth";

/** Composite admin metrics router: admin.metrics.{economy,activity,moderation,growth} */
export const adminMetricsRouter = router({
  economy: economyMetricsRouter,
  activity: activityMetricsRouter,
  moderation: moderationMetricsRouter,
  growth: growthMetricsRouter,
});
