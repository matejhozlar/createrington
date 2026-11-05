import { z } from "zod";
import { router, ownerProcedure } from "@/trpc/trpc";
import { auditActor, rethrowTrpc } from "@/trpc/utils";
import { Q } from "@/db";
import { featureFlagService, FeatureFlags } from "@/services/feature-flag";

const CDN_FLAG_DESCRIPTION =
  "Serve pack files and files a player adds that CurseForge gives no link for from their built address on CurseForge's CDN";

export const ownerCurseforgeCdnRouter = router({
  get: ownerProcedure
    .meta({
      description:
        "Whether the launcher serves pack files and files a player adds without a CurseForge link from CurseForge's CDN",
    })
    .query(async () => ({
      enabled: await featureFlagService.isEnabled(
        FeatureFlags.launcherCurseforgeCdn,
      ),
    })),

  update: ownerProcedure
    .meta({
      description:
        "Switch the launcher's CurseForge CDN fallback for pack files and files a player adds on or off",
    })
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const flag = await featureFlagService.setEnabled(
          FeatureFlags.launcherCurseforgeCdn,
          input.enabled,
          CDN_FLAG_DESCRIPTION,
        );
        await Q.admin.log.action.logAction({
          ...auditActor(ctx),
          actionType: "feature_flag_set",
          description: `${input.enabled ? "Enabled" : "Disabled"} feature "${flag.name}"`,
          metadata: { name: flag.name, enabled: flag.enabled },
        });
        return { enabled: flag.enabled };
      } catch (error) {
        rethrowTrpc(error);
      }
    }),
});
