import semver from "semver";

export function isValidVersion(version: string): boolean {
  return semver.valid(version) === version;
}

export function isNewerVersion(candidate: string, than: string): boolean {
  return semver.gt(candidate, than);
}

export function newestVersion<T extends { version: string }>(
  releases: readonly T[],
): T | null {
  let newest: T | null = null;
  for (const release of releases) {
    if (!isValidVersion(release.version)) continue;
    if (!newest || semver.gt(release.version, newest.version)) {
      newest = release;
    }
  }
  return newest;
}

export function newestFirst<T extends { version: string }>(
  releases: readonly T[],
): T[] {
  return releases
    .filter((release) => isValidVersion(release.version))
    .sort((a, b) => semver.rcompare(a.version, b.version));
}

export function groupByVersion<T extends { version: string }>(
  releases: readonly T[],
): [T, ...T[]][] {
  const groups = new Map<string, [T, ...T[]]>();
  for (const release of newestFirst(releases)) {
    const group = groups.get(release.version);
    if (group) {
      group.push(release);
    } else {
      groups.set(release.version, [release]);
    }
  }
  return [...groups.values()];
}

export function mergeVersionBuilds<
  T extends { platform: string; releasedAt: Date | null },
>(
  builds: readonly [T, ...T[]],
  platformOrder: readonly string[],
): { builds: [T, ...T[]]; releasedAt: Date | null } {
  const rank = (platform: string) => {
    const index = platformOrder.indexOf(platform);
    return index === -1 ? platformOrder.length : index;
  };
  const ordered = [...builds].sort(
    (a, b) => rank(a.platform) - rank(b.platform),
  ) as [T, ...T[]];
  const releaseTimes = ordered.flatMap((build) =>
    build.releasedAt ? [build.releasedAt.getTime()] : [],
  );

  return {
    builds: ordered,
    releasedAt:
      releaseTimes.length > 0 ? new Date(Math.min(...releaseTimes)) : null,
  };
}

export function isDownloadUrlAllowed(
  rawUrl: string,
  allowedHosts: readonly string[],
): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  return allowedHosts.includes(url.hostname.toLowerCase());
}
