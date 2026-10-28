import { z } from "zod";
import { router, ownerProcedure, launcherAvailable } from "@/trpc/trpc";
import { id, rethrowTrpc } from "@/trpc/utils";
import config from "@/config";
import { launcherReleaseService } from "@/services/launcher/release/launcher-release.service";
import type { LauncherRelease } from "@createrington/shared/db/launcher_release.types";

const launcherOwnerProcedure = ownerProcedure.use(launcherAvailable);

const idInput = z.object({ id: id() });
const releaseInput = idInput.extend({ required: z.boolean().default(false) });

function toDto(release: LauncherRelease) {
  return {
    id: release.id,
    version: release.version,
    platform: release.platform,
    url: release.url,
    notes: release.notes,
    status: release.status,
    required: release.required,
    pubDate: release.pubDate.toISOString(),
    createdAt: release.createdAt.toISOString(),
    releasedAt: release.releasedAt?.toISOString() ?? null,
    withdrawnAt: release.withdrawnAt?.toISOString() ?? null,
    prunedAt: release.prunedAt?.toISOString() ?? null,
  };
}

export const ownerLauncherReleasesRouter = router({
  list: launcherOwnerProcedure
    .meta({
      description:
        "List the launcher releases stored for this environment's channel, newest first",
    })
    .query(async () => {
      const releases = await launcherReleaseService.list();
      return {
        channel: config.launcher.channel,
        enabled: launcherReleaseService.isEnabled(),
        releases: releases.map(toDto),
      };
    }),

  release: launcherOwnerProcedure
    .meta({
      description:
        "Release a pending launcher version so the update check offers it, optionally as an update older launchers must take",
    })
    .input(releaseInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return toDto(
          await launcherReleaseService.release(
            input.id,
            ctx.user.discordId,
            input.required,
          ),
        );
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  withdraw: launcherOwnerProcedure
    .meta({
      description:
        "Withdraw a pending or released launcher version so it is never offered",
    })
    .input(idInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return toDto(
          await launcherReleaseService.withdraw(input.id, ctx.user.discordId),
        );
      } catch (error) {
        rethrowTrpc(error);
      }
    }),
});
