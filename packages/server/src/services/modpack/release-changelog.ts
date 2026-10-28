import { Q } from "@/db";
import type { ReleaseModRow } from "@/db/queries/modpack/release/mod";
import type { ChangelogInput } from "@/discord/components/presets/modpack-changelog";
import {
  createKeyValueStore,
  readStoredMany,
  writeStored,
} from "@/services/key-value-store";
import type { Modpack, ModpackRelease } from "@createrington/shared/db";
import { toChangelogInputs } from "./changelog";
import type { ModpackReleaseDiff, ModpackReleaseDiffEntry } from "./index";

const KEY_PREFIX = "modpack:changelog:v1";
const CHANGELOG_TTL_MS = 5 * 60_000;
const MAX_MEMORY_CHANGELOGS = 1000;

const changelogs = createKeyValueStore(MAX_MEMORY_CHANGELOGS);

type StoredChangelog = Omit<ChangelogInput, "release"> & {
  release: Omit<ChangelogInput["release"], "publishedAt"> & {
    publishedAt: string | null;
  };
};

type ReleaseRow = ReleaseModRow & { releaseId: number };

function keyOf(releaseId: number): string {
  return `${KEY_PREFIX}:${releaseId}`;
}

function revive(stored: StoredChangelog): ChangelogInput {
  const { publishedAt } = stored.release;
  return {
    ...stored,
    release: {
      ...stored.release,
      publishedAt: publishedAt === null ? null : new Date(publishedAt),
    },
  };
}

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

function diffOf(
  release: ModpackRelease,
  previous: ModpackRelease | null,
  releaseRows: ReleaseRow[],
  previousRows: ReleaseRow[],
): ModpackReleaseDiff {
  const before = groupByProject(previousRows);
  const current = groupByProject(releaseRows);

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
    previous,
    added,
    updated,
    removed,
    unchanged,
  };
}

/**
 * What each release changed against the one recorded before it, in the order
 * given, from two queries however many releases are asked: one for the
 * preceding releases, one for the frozen mod rows of both sides, so this keeps
 * working after CurseForge archives the files. A manifest may ship a project
 * as several files, so a project counts as changed when its whole set of
 * files does, not when one row differs.
 */
export async function getReleaseDiffs(
  releases: ModpackRelease[],
): Promise<ModpackReleaseDiff[]> {
  if (releases.length === 0) return [];
  const preceding = await Q.modpack.release.listPreceding(
    releases.map((release) => release.id),
  );
  const previousOf = new Map<number, ModpackRelease>();
  for (const { successorId, ...previous } of preceding) {
    previousOf.set(successorId, previous);
  }

  const releaseIds = new Set<number>();
  for (const release of releases) {
    releaseIds.add(release.id);
    const previous = previousOf.get(release.id);
    if (previous) releaseIds.add(previous.id);
  }
  const rows = await Q.modpack.release.mod.listForReleases([...releaseIds]);
  const rowsOf = new Map<number, ReleaseRow[]>();
  for (const row of rows) {
    const held = rowsOf.get(row.releaseId);
    if (held) held.push(row);
    else rowsOf.set(row.releaseId, [row]);
  }

  return releases.map((release) => {
    const previous = previousOf.get(release.id) ?? null;
    return diffOf(
      release,
      previous,
      rowsOf.get(release.id) ?? [],
      previous ? (rowsOf.get(previous.id) ?? []) : [],
    );
  });
}

/** What a release changed against the one before it; throws NotFoundError for an unknown release. */
export async function getReleaseDiff(
  releaseId: number,
): Promise<ModpackReleaseDiff> {
  const release = await Q.modpack.release.get({ id: releaseId });
  const [diff] = await getReleaseDiffs([release]);
  return diff;
}

/**
 * Presentation-ready changelogs of recorded releases of one modpack, in the
 * order given: each diff with labels, links and the publish notes. Kept for
 * five minutes per release in a store shared by every process, so notes
 * edited meanwhile show up after that at the latest. The releases missing
 * from the store are diffed and dressed together, in a handful of queries
 * for the whole list rather than a few per release.
 */
export async function getReleaseChangelogs(
  modpack: Modpack,
  releases: ModpackRelease[],
): Promise<ChangelogInput[]> {
  if (releases.length === 0) return [];
  const stored = await readStoredMany<StoredChangelog>(
    changelogs,
    releases.map((release) => keyOf(release.id)),
  );

  const missing = releases.filter((_, index) => stored[index] === undefined);
  const inputs =
    missing.length === 0
      ? []
      : await toChangelogInputs(modpack, await getReleaseDiffs(missing));
  await Promise.all(
    missing.map((release, index) =>
      writeStored(
        changelogs,
        keyOf(release.id),
        inputs[index],
        CHANGELOG_TTL_MS,
      ),
    ),
  );

  let next = 0;
  return releases.map((_, index) => {
    const held = stored[index];
    return held === undefined ? inputs[next++] : revive(held);
  });
}

/** Presentation-ready changelog of one recorded release, from the same store as `getReleaseChangelogs`. */
export async function getReleaseChangelog(
  modpack: Modpack,
  release: ModpackRelease,
): Promise<ChangelogInput> {
  const [changelog] = await getReleaseChangelogs(modpack, [release]);
  return changelog;
}
