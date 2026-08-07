import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import { auditActor, rethrowTrpc } from "@/trpc/utils";
import {
  featureFlagService,
  FeatureFlags,
  type FeatureFlagName,
} from "@/services/feature-flag";

const flagNames = Object.values(FeatureFlags) as [
  FeatureFlagName,
  ...FeatureFlagName[],
];

export const adminFeaturesRouter = router({
  list: adminProcedure
    .meta({ description: "List all feature flags" })
    .query(() => featureFlagService.list()),

  set: adminProcedure
    .meta({ description: "Enable or disable a feature flag" })
    .input(
      z.object({
        name: z.enum(flagNames),
        enabled: z.boolean(),
        description: z.string().trim().max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
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
      } catch (error) {
        rethrowTrpc(error);
      }
    }),
});
