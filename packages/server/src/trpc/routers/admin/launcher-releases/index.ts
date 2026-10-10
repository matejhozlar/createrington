import { router, adminProcedure } from "@/trpc/trpc";
import config from "@/config";
import { launcherReleaseService } from "@/services/launcher/release/launcher-release.service";
import { groupByVersion } from "@/services/launcher/release/release-rules";
import { parseStructuredNotes } from "@/services/launcher/release/structured-notes";
import { LAUNCHER_PLATFORMS } from "@createrington/shared/launcher";
import type { LauncherRelease } from "@createrington/shared/db/launcher_release.types";

const PLATFORM_ORDER: readonly string[] = LAUNCHER_PLATFORMS;

function toVersionDto(builds: [LauncherRelease, ...LauncherRelease[]]) {
  const ordered = [...builds].sort(
    (a, b) =>
      PLATFORM_ORDER.indexOf(a.platform) - PLATFORM_ORDER.indexOf(b.platform),
  );
  const [first] = ordered;
  const releaseTimes = ordered.flatMap((build) =>
    build.releasedAt ? [build.releasedAt.getTime()] : [],
  );

  return {
    version: first.version,
    notes: first.notes,
    structuredNotes: parseStructuredNotes(first.structuredNotes),
    releasedAt:
      releaseTimes.length > 0
        ? new Date(Math.min(...releaseTimes)).toISOString()
        : null,
    downloads: ordered.map((build) => ({
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
