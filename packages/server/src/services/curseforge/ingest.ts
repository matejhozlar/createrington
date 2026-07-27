import { Q } from "@/db";
import type {
  CurseforgeProject,
  CurseforgeProjectCreate,
} from "@createrington/shared/db";
import {
  getMod,
  getMods,
  getModDescription,
  type CurseForgeProjectData,
} from "./index";
import { sanitizeDescription } from "./sanitize";

// CurseForge reports int64 counters; the column is int4
const INT4_MAX = 2_147_483_647;

function toCreate(
  data: CurseForgeProjectData,
  descriptionHtml?: string,
): CurseforgeProjectCreate {
  return {
    id: data.id,
    classId: data.classId,
    slug: data.slug,
    name: data.name,
    summary: data.summary || null,
    logoUrl: data.logoUrl,
    thumbnailUrl: data.thumbnailUrl,
    websiteUrl: data.websiteUrl,
    primaryAuthor: data.authors[0]?.name ?? null,
    authors: data.authors,
    categories: data.categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      iconUrl: c.iconUrl,
    })),
    links: {
      website: data.websiteUrl,
      wiki: data.wikiUrl,
      issues: data.issuesUrl,
      source: data.sourceUrl,
    },
    ...(descriptionHtml !== undefined ? { descriptionHtml } : {}),
    screenshots: data.screenshots,
    downloadCount: Math.min(data.downloadCount, INT4_MAX),
    gamePopularityRank: data.gamePopularityRank,
    dateCreated: new Date(data.dateCreated),
    dateModified: new Date(data.dateModified),
    dateReleased: new Date(data.dateReleased),
    allowModDistribution: data.allowModDistribution,
    isAvailable: data.isAvailable,
    cfStatus: data.status,
    refreshedAt: new Date(),
    updatedAt: new Date(),
  };
}

const BASE_UPDATE_FIELDS: Array<keyof CurseforgeProjectCreate> = [
  "classId",
  "slug",
  "name",
  "summary",
  "logoUrl",
  "thumbnailUrl",
  "websiteUrl",
  "primaryAuthor",
  "authors",
  "categories",
  "links",
  "screenshots",
  "downloadCount",
  "gamePopularityRank",
  "dateCreated",
  "dateModified",
  "dateReleased",
  "allowModDistribution",
  "isAvailable",
  "cfStatus",
  "refreshedAt",
  "updatedAt",
];

/**
 * Fetch a project from CurseForge and upsert its snapshot into the cache.
 * Returns both the stored entity and the live API data (for validation that
 * needs file indexes). Description fetch can be skipped for cheap refreshes.
 */
export async function ingestProject(
  projectId: number,
  options: { withDescription?: boolean } = {},
): Promise<{ entity: CurseforgeProject; data: CurseForgeProjectData }> {
  const { withDescription = true } = options;

  const data = await getMod(projectId);

  let descriptionHtml: string | undefined;
  if (withDescription) {
    try {
      const raw = await getModDescription(projectId);
      descriptionHtml = raw ? sanitizeDescription(raw) : "";
    } catch (error) {
      logger.warn(
        `Description fetch failed for CurseForge project #${projectId}, keeping cached value`,
        error,
      );
    }
  }

  const updateFields =
    descriptionHtml !== undefined
      ? [...BASE_UPDATE_FIELDS, "descriptionHtml" as const]
      : BASE_UPDATE_FIELDS;

  const entity = await Q.curseforge.project.upsert(
    toCreate(data, descriptionHtml),
    "id",
    updateFields,
  );

  return { entity, data };
}

/**
 * Batch-refresh cached snapshots for many projects without touching
 * descriptions. Intended for periodic refresh of active votes.
 */
export async function refreshProjects(projectIds: number[]): Promise<number> {
  if (projectIds.length === 0) return 0;

  const projects = await getMods(projectIds);
  for (const data of projects) {
    await Q.curseforge.project.upsert(toCreate(data), "id", BASE_UPDATE_FIELDS);
  }
  return projects.length;
}
