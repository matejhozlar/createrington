import { router, adminProcedure } from "@/trpc/trpc";
import config from "@/config";
import { launcherReleaseService } from "@/services/launcher/release/launcher-release.service";
import { parseStructuredNotes } from "@/services/launcher/release/structured-notes";

export const adminLauncherReleasesRouter = router({
  list: adminProcedure
    .meta({
      description:
        "List the released launcher versions of this environment's channel, highest version first",
    })
    .query(async () => {
      const releases = await launcherReleaseService.listReleased();
      return {
        channel: config.launcher.channel,
        releases: releases.map((release) => ({
          id: release.id,
          version: release.version,
          platform: release.platform,
          url: release.url,
          notes: release.notes,
          structuredNotes: parseStructuredNotes(release.structuredNotes),
          releasedAt: release.releasedAt?.toISOString() ?? null,
        })),
      };
    }),
});
