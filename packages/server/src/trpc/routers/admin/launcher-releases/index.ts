import { router, adminProcedure } from "@/trpc/trpc";
import config from "@/config";
import { launcherReleaseService } from "@/services/launcher/release/launcher-release.service";
import {
  groupByVersion,
  mergeVersionBuilds,
} from "@/services/launcher/release/release-rules";
import { parseStructuredNotes } from "@/services/launcher/release/structured-notes";
import { LAUNCHER_PLATFORMS } from "@createrington/shared/launcher";
import type { LauncherRelease } from "@createrington/shared/db/launcher_release.types";

function toVersionDto(group: [LauncherRelease, ...LauncherRelease[]]) {
  const { builds, releasedAt } = mergeVersionBuilds(group, LAUNCHER_PLATFORMS);
  const [first] = builds;

  return {
    version: first.version,
    notes: first.notes,
    structuredNotes: parseStructuredNotes(first.structuredNotes),
    releasedAt: releasedAt?.toISOString() ?? null,
    downloads: builds.map((build) => ({
      platform: build.platform,
      url: build.url,
    })),
  };
}

export const adminLauncherReleasesRouter = router({
  list: adminProcedure
    .meta({
      description:
        "List the released launcher versions of this environment's channel with a download per released platform, highest version first",
    })
    .query(async () => {
      const releases = await launcherReleaseService.listReleased();
      return {
        channel: config.launcher.channel,
        releases: groupByVersion(releases).map(toVersionDto),
      };
    }),
});
