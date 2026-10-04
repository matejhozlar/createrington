import { Q } from "@/db";
import type { ReleaseModRow } from "@/db/queries/modpack/release/mod";
import type { ChangelogInput } from "@/discord/components/presets/modpack-changelog";
import type { Modpack, ModpackRelease } from "@createrington/shared/db";
import { LAUNCHER_PACK_RELEASES_MAX_PAGE_SIZE } from "@createrington/shared/launcher";
import { toChangelogInput } from "./changelog";
import type { ModpackReleaseDiff, ModpackReleaseDiffEntry } from "./index";

const CHANGELOG_CACHE_TTL_MS = 5 * 60_000;
const CHANGELOG_CACHE_MAX = 4 * LAUNCHER_PACK_RELEASES_MAX_PAGE_SIZE;

const changelogCache = new Map<
  number,
  { expiresAt: number; changelog: Promise<ChangelogInput> }
>();

function groupByProject(
  rows: ReleaseModRow[],
): Map<number, [ReleaseModRow, ...ReleaseModRow[]]> {
  const grouped = new Map<number, [ReleaseModRow, ...ReleaseModRow[]]>();
  for (const row of rows) {
    const held = grouped.get(row.curseforgeProjectId);
    if (held) held.push(row);
    else grouped.set(row.curseforgeProjectId, [row]);
  }
  for (const files of grouped.values()) {
    files.sort((a, b) => a.fileId - b.fileId);
  }
  return grouped;
}

function sameFiles(a: ReleaseModRow[], b: ReleaseModRow[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (row, index) =>
        row.fileId === b[index].fileId && row.required === b[index].required,
    )
  );
}

/**
 * What a release changed against the one before it. Both sides are read from
 * frozen rows, so this keeps working after CurseForge archives the files.
 */
export async function getReleaseDiff(
  releaseId: number,
): Promise<ModpackReleaseDiff> {
  const release = await Q.modpack.release.get({ id: releaseId });
  const [previous] = await Q.modpack.release.findAll(
    { modpackId: release.modpackId, id: { $lt: release.id } },
    { orderBy: "id", orderDirection: "desc", limit: 1 },
  );

  const rows = await Q.modpack.release.mod.listForReleases(
    previous ? [release.id, previous.id] : [release.id],
  );
  // A manifest may ship a project as several files, so a project counts as
  // changed when its whole set of files does, not when one row differs
  const before = groupByProject(
    rows.filter((row) => row.releaseId === previous?.id),
  );
  const current = groupByProject(
    rows.filter((row) => row.releaseId === release.id),
  );

  const added: ModpackReleaseDiffEntry[] = [];
  const updated: ModpackReleaseDiffEntry[] = [];
  let unchanged = 0;
  for (const [projectId, files] of current) {
    const prior = before.get(projectId);
    if (!prior) {
      if (previous) added.push({ ...files[0], previousFile: null });
      else unchanged++;
      continue;
    }
    if (sameFiles(prior, files)) {
      unchanged++;
      continue;
    }
    updated.push({ ...files[0], previousFile: prior[0] });
  }

  const removed: ModpackReleaseDiffEntry[] = [...before]
    .filter(([projectId]) => !current.has(projectId))
    .map(([, files]) => ({ ...files[0], previousFile: null }));

  return {
    release,
    previous: previous ?? null,
    added,
    updated,
    removed,
    unchanged,
  };
}

/**
 * Presentation-ready changelog of a recorded release: its diff with labels,
 * links and the publish notes. Kept for five minutes per release, shared by
 * every caller, so notes edited meanwhile show up after that at the latest.
 * The cache holds several full pages of the launcher's releases list, which
 * asks for one changelog per row.
 */
export function getReleaseChangelog(
  modpack: Modpack,
  release: ModpackRelease,
): Promise<ChangelogInput> {
  const now = Date.now();
  const cached = changelogCache.get(release.id);
  if (cached && cached.expiresAt > now) {
    changelogCache.delete(release.id);
    changelogCache.set(release.id, cached);
    return cached.changelog;
  }
  changelogCache.delete(release.id);
  const changelog = getReleaseDiff(release.id).then((diff) =>
    toChangelogInput(modpack, diff),
  );
  changelogCache.set(release.id, {
    expiresAt: now + CHANGELOG_CACHE_TTL_MS,
    changelog,
  });
  changelog.catch(() => {
    if (changelogCache.get(release.id)?.changelog === changelog) {
      changelogCache.delete(release.id);
    }
  });
  if (changelogCache.size > CHANGELOG_CACHE_MAX) {
    changelogCache.delete(changelogCache.keys().next().value as number);
  }
  return changelog;
}
