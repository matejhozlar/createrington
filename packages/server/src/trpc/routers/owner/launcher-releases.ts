import { z } from "zod";
import { router, ownerProcedure } from "@/trpc/trpc";
import { rethrowTrpc } from "@/trpc/utils";
import config from "@/config";
import { launcherReleaseService } from "@/services/launcher/release/launcher-release.service";
import type { LauncherRelease } from "@createrington/shared/db/launcher_release.types";

function toDto(release: LauncherRelease) {
  return {
    id: release.id,
    version: release.version,
    platform: release.platform,
    url: release.url,
    notes: release.notes,
    status: release.status,
    pubDate: release.pubDate.toISOString(),
    createdAt: release.createdAt.toISOString(),
    releasedAt: release.releasedAt?.toISOString() ?? null,
    withdrawnAt: release.withdrawnAt?.toISOString() ?? null,
  };
}

export const ownerLauncherReleasesRouter = router({
  list: ownerProcedure
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

  release: ownerProcedure
    .meta({
      description:
        "Release a pending launcher version so the update check offers it",
    })
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return toDto(
          await launcherReleaseService.release(input.id, ctx.user.discordId),
        );
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  withdraw: ownerProcedure
    .meta({
      description:
        "Withdraw a pending or released launcher version so it is never offered",
    })
    .input(z.object({ id: z.number().int().positive() }))
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
