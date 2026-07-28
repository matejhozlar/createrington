import { Q } from "@/db";
import type {
  CurseforgeProject,
  CurseforgeProjectCreate,
} from "@createrington/shared/db";
import { getMod, getMods, type CurseForgeProjectData } from "./index";

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
  return { entity, data };
}

/**
 * Batch-refresh cached snapshots for many projects. Intended for periodic
 * refresh of the projects in active votes.
 */
export async function refreshProjects(projectIds: number[]): Promise<number> {
  if (projectIds.length === 0) return 0;

  const projects = await getMods(projectIds);
  for (const data of projects) {
    await Q.curseforge.project.upsert(toCreate(data), "id", UPDATE_FIELDS);
  }
  return projects.length;
}
