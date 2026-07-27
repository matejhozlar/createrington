import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import { auditActor } from "@/trpc/utils";
import { featureFlagService } from "@/services/feature-flag";

export const adminFeaturesRouter = router({
  list: adminProcedure
    .meta({ description: "List all feature flags" })
    .query(() => featureFlagService.list()),

  set: adminProcedure
    .meta({ description: "Enable or disable a feature flag" })
    .input(
      z.object({
        name: z.string().trim().min(1).max(64),
        enabled: z.boolean(),
        description: z.string().trim().max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const flag = await featureFlagService.setEnabled(
        input.name,
        input.enabled,
        input.description,
      );
      await Q.admin.log.action.logAction({
        ...auditActor(ctx),
        actionType: "feature_flag_set",
        description: `${input.enabled ? "Enabled" : "Disabled"} feature "${input.name}"`,
        metadata: { name: input.name, enabled: input.enabled },
      });
      return flag;
    }),
});
