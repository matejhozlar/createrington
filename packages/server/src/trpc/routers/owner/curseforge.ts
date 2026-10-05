import { z } from "zod";
import { router, ownerProcedure } from "@/trpc/trpc";
import { auditActor, rethrowTrpc } from "@/trpc/utils";
import { Q } from "@/db";
import {
  CURSEFORGE_CALL_COUNTS,
  curseforgeCallCounter,
} from "@/services/curseforge/call-counter";
import { featureFlagService, FeatureFlags } from "@/services/feature-flag";

const DEFAULT_DAYS = 14;
const MAX_DAYS = 90;
const CDN_FLAG_DESCRIPTION =
  "Serve pack files CurseForge gives no link for from their built address on CurseForge's CDN";

export const ownerCurseforgeCallsRouter = router({
  list: ownerProcedure
    .meta({
      description:
        "List the calls this app made to the CurseForge API per UTC day, today first",
    })
    .input(
      z
        .object({
          days: z.number().int().min(1).max(MAX_DAYS).default(DEFAULT_DAYS),
        })
        .default({ days: DEFAULT_DAYS }),
    )
    .query(async ({ input }) => {
      const { stored, days } = await curseforgeCallCounter.read(
        CURSEFORGE_CALL_COUNTS,
        input.days,
      );
      return {
        stored,
        days: days.map(({ date, counts }) => ({ date, ...counts })),
      };
    }),
});

export const ownerCurseforgeCdnRouter = router({
  get: ownerProcedure
    .meta({
      description:
        "Whether the launcher serves pack files without a CurseForge link from CurseForge's CDN",
    })
    .query(async () => ({
      enabled: await featureFlagService.isEnabled(
        FeatureFlags.launcherCurseforgeCdn,
      ),
    })),

  update: ownerProcedure
    .meta({
      description:
        "Switch the launcher's CurseForge CDN fallback for pack files on or off",
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
