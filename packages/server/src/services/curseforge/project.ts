import type { CurseforgeProject } from "@createrington/shared/db";
import { CURSEFORGE_CLASSES } from "@createrington/shared/workshop";

const CURSEFORGE_SITE = "https://www.curseforge.com/minecraft";

const CLASS_SITE_PATHS: Record<number, string> = {
  [CURSEFORGE_CLASSES.mods]: "mc-mods",
  [CURSEFORGE_CLASSES.modpacks]: "modpacks",
  [CURSEFORGE_CLASSES.resourcePacks]: "texture-packs",
  [CURSEFORGE_CLASSES.shaders]: "shaders",
  [CURSEFORGE_CLASSES.dataPacks]: "data-packs",
};

export interface CurseForgeProjectPage {
  websiteUrl: string | null | undefined;
  classId: number;
  slug: string;
}

export function curseforgeProjectUrl(
  project: CurseForgeProjectPage,
): string | null {
  const known = project.websiteUrl?.replace(/\/+$/, "");
  if (known) return known;
  const sitePath = CLASS_SITE_PATHS[project.classId];
  return sitePath
    ? `${CURSEFORGE_SITE}/${sitePath}/${encodeURIComponent(project.slug)}`
    : null;
}

export function projectLabel(
  name: string | null | undefined,
  projectId: number,
): string {
  return name ?? `#${projectId}`;
}

export type CurseforgeProjectSummary = Pick<
  CurseforgeProject,
  | "id"
  | "classId"
  | "name"
  | "slug"
  | "summary"
  | "thumbnailUrl"
  | "websiteUrl"
  | "primaryAuthor"
  | "categories"
  | "downloadCount"
  | "dateReleased"
  | "allowModDistribution"
  | "environment"
  | "environmentSource"
>;

export function toProjectSummary(
  project: CurseforgeProject,
): CurseforgeProjectSummary {
  return {
    id: project.id,
    classId: project.classId,
    name: project.name,
    slug: project.slug,
    summary: project.summary,
    thumbnailUrl: project.thumbnailUrl,
    websiteUrl: project.websiteUrl,
    primaryAuthor: project.primaryAuthor,
    categories: project.categories,
    downloadCount: project.downloadCount,
    dateReleased: project.dateReleased,
    allowModDistribution: project.allowModDistribution,
    environment: project.environment,
    environmentSource: project.environmentSource,
  };
}
