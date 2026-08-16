import { Q } from "@/db";
import type {
  CurseforgeProject,
  CurseforgeProjectCreate,
} from "@createrington/shared/db";
import {
  getMod,
  getMods,
  type CurseForgeEnvironmentHint,
  type CurseForgeProjectData,
} from "./index";

// CurseForge reports int64 counters; the column is int4
const INT4_MAX = 2_147_483_647;

function toCreate(data: CurseForgeProjectData): CurseforgeProjectCreate {
  return {
    id: data.id,
    classId: data.classId,
    slug: data.slug,
    name: data.name,
    summary: data.summary || null,
    thumbnailUrl: data.thumbnailUrl,
    websiteUrl: data.websiteUrl,
    primaryAuthor: data.authors[0]?.name ?? null,
    environment: data.environmentHint ?? "unspecified",
    environmentSource: data.environmentHint ? "cf_flag" : null,
    categories: data.categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      iconUrl: c.iconUrl,
    })),
    screenshots: data.screenshots,
    downloadCount: Math.min(data.downloadCount, INT4_MAX),
    dateModified: new Date(data.dateModified),
    dateReleased: new Date(data.dateReleased),
    allowModDistribution: data.allowModDistribution,
    isAvailable: data.isAvailable,
    refreshedAt: new Date(),
    updatedAt: new Date(),
  };
}

const UPDATE_FIELDS: Array<keyof CurseforgeProjectCreate> = [
  "classId",
  "slug",
  "name",
  "summary",
  "thumbnailUrl",
  "websiteUrl",
  "primaryAuthor",
  "categories",
  "screenshots",
  "downloadCount",
  "dateModified",
  "dateReleased",
  "allowModDistribution",
  "isAvailable",
  "refreshedAt",
  "updatedAt",
];

async function applyEnvironmentHints(
  projects: CurseForgeProjectData[],
): Promise<void> {
  const hinted = projects.filter((data) => data.environmentHint !== null);
  if (hinted.length === 0) return;

  const rows = await Q.curseforge.project.findAll(
    { id: { $in: hinted.map((data) => data.id) } },
    { select: ["id", "environment", "environmentSource"] },
  );
  const byId = new Map(rows.map((row) => [row.id, row]));
  const idsByHint = new Map<CurseForgeEnvironmentHint, number[]>();
  for (const data of hinted) {
    const hint = data.environmentHint!;
    const row = byId.get(data.id);
    if (!row || row.environmentSource === "manual") continue;
    if (row.environment === hint && row.environmentSource === "cf_flag") {
      continue;
    }
    const ids = idsByHint.get(hint) ?? [];
    ids.push(data.id);
    idsByHint.set(hint, ids);
  }
  for (const [hint, ids] of idsByHint) {
    await Q.curseforge.project.updateAll(
      { environment: hint, environmentSource: "cf_flag" },
      { id: { $in: ids } },
    );
  }
}

/**
 * Fetch a project from CurseForge and upsert its snapshot into the cache.
 * Returns both the stored entity and the live API data (for validation that
 * needs file indexes).
 */
export async function ingestProject(
  projectId: number,
): Promise<{ entity: CurseforgeProject; data: CurseForgeProjectData }> {
  const data = await getMod(projectId);
  const entity = await Q.curseforge.project.upsert(
    toCreate(data),
    "id",
    UPDATE_FIELDS,
  );
  await applyEnvironmentHints([data]);
  return { entity, data };
}

/**
 * Fetch many projects in one batch and upsert their snapshots. Returns the
 * live API data keyed by project ID; IDs CurseForge did not resolve are absent.
 */
export async function ingestProjects(
  projectIds: number[],
): Promise<Map<number, CurseForgeProjectData>> {
  if (projectIds.length === 0) return new Map();

  const projects = await getMods(projectIds);
  const byId = new Map<number, CurseForgeProjectData>();
  for (const data of projects) {
    await Q.curseforge.project.upsert(toCreate(data), "id", UPDATE_FIELDS);
    byId.set(data.id, data);
  }
  await applyEnvironmentHints(projects);
  return byId;
}

/**
 * Batch-refresh cached snapshots for many projects. Intended for periodic
 * refresh of the projects in active workshops.
 */
export async function refreshProjects(projectIds: number[]): Promise<number> {
  if (projectIds.length === 0) return 0;

  const projects = await getMods(projectIds);
  for (const data of projects) {
    await Q.curseforge.project.upsert(toCreate(data), "id", UPDATE_FIELDS);
  }
  await applyEnvironmentHints(projects);
  return projects.length;
}
