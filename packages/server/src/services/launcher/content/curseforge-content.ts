import type {
  CurseforgeFileProject,
  CurseforgeFileWithProject,
} from "@/db/queries/curseforge/file";
import {
  CurseForgeLoader,
  type CurseForgeContentFile,
  type CurseForgeProjectData,
} from "@/services/curseforge";
import {
  LAUNCHER_CONTENT_LOADERS,
  type LauncherContentFile,
  type LauncherContentFileDetails,
  type LauncherContentKind,
  type LauncherContentLoader,
  type LauncherContentReleaseType,
  type LauncherProject,
  type LauncherProjectLatestFile,
} from "@createrington/shared/launcher";
import { CURSEFORGE_CLASSES } from "@createrington/shared/workshop";

const CURSEFORGE_SITE = "https://www.curseforge.com/minecraft";
const GAME_VERSION_PATTERN = /^\d+\.\d+/;

const CONTENT_CLASSES: Record<
  number,
  { kind: LauncherContentKind; sitePath: string }
> = {
  [CURSEFORGE_CLASSES.mods]: { kind: "mod", sitePath: "mc-mods" },
  [CURSEFORGE_CLASSES.resourcePacks]: {
    kind: "resourcepack",
    sitePath: "texture-packs",
  },
  [CURSEFORGE_CLASSES.shaders]: { kind: "shader", sitePath: "shaders" },
};

const CLASS_BY_KIND: Record<LauncherContentKind, number> = {
  mod: CURSEFORGE_CLASSES.mods,
  resourcepack: CURSEFORGE_CLASSES.resourcePacks,
  shader: CURSEFORGE_CLASSES.shaders,
};

const RELEASE_TYPES: Record<number, LauncherContentReleaseType> = {
  1: "release",
  2: "beta",
  3: "alpha",
};

const LOADER_NAMES = new Set<string>(LAUNCHER_CONTENT_LOADERS);

const LOADERS_BY_TYPE = new Map<number, LauncherContentLoader>(
  LAUNCHER_CONTENT_LOADERS.map((loader) => [CurseForgeLoader[loader], loader]),
);

type ProjectPage = Pick<
  CurseforgeFileProject,
  "websiteUrl" | "classId" | "slug"
>;

export function contentKindForClass(
  classId: number,
): LauncherContentKind | null {
  return CONTENT_CLASSES[classId]?.kind ?? null;
}

export function classForContentKind(kind: LauncherContentKind): number {
  return CLASS_BY_KIND[kind];
}

export function curseforgeProjectUrl(project: ProjectPage): string | null {
  const sitePath = CONTENT_CLASSES[project.classId]?.sitePath;
  return (
    project.websiteUrl?.replace(/\/+$/, "") ||
    (sitePath ? `${CURSEFORGE_SITE}/${sitePath}/${project.slug}` : null)
  );
}

export function curseforgeFilePageUrl(
  project: ProjectPage,
  fileId: number,
): string | null {
  const projectUrl = curseforgeProjectUrl(project);
  return projectUrl ? `${projectUrl}/files/${fileId}` : null;
}

export function toLauncherProject(
  project: CurseforgeFileProject,
): LauncherProject | null {
  const kind = contentKindForClass(project.classId);
  const url = curseforgeProjectUrl(project);
  if (!kind || !url) return null;
  return {
    source: "curseforge",
    id: String(project.id),
    slug: project.slug,
    kind,
    name: project.name,
    summary: project.summary,
    author: project.primaryAuthor,
    iconUrl: project.thumbnailUrl,
    url,
  };
}

export function toLauncherProjectLatestFiles(
  indexes: CurseForgeProjectData["latestFilesIndexes"],
): LauncherProjectLatestFile[] {
  return indexes.map((index) => ({
    fileId: String(index.fileId),
    fileName: index.filename,
    gameVersion: index.gameVersion,
    loader:
      index.modLoader === null
        ? null
        : (LOADERS_BY_TYPE.get(index.modLoader) ?? null),
    releaseType: RELEASE_TYPES[index.releaseType] ?? "release",
  }));
}

export function toLauncherContentFile(
  file: CurseforgeFileWithProject,
): LauncherContentFile | null {
  const pageUrl = curseforgeFilePageUrl(file.project, file.id);
  if (!pageUrl) return null;
  return {
    source: "curseforge",
    projectId: String(file.curseforgeProjectId),
    id: String(file.id),
    fileName: file.fileName,
    size: file.fileSize,
    sha1: file.sha1,
    pageUrl,
    download: { servedBy: file.source, url: file.downloadUrl },
  };
}

export function toLauncherContentFileDetails(
  file: CurseForgeContentFile,
  projectUrl: string,
): LauncherContentFileDetails | null {
  if (!file.fileName || file.fileLength === null || !file.sha1) return null;
  return {
    source: "curseforge",
    projectId: String(file.projectId),
    id: String(file.id),
    fileName: file.fileName,
    size: file.fileLength,
    sha1: file.sha1,
    pageUrl: `${projectUrl}/files/${file.id}`,
    download: file.downloadUrl
      ? { servedBy: "curseforge", url: file.downloadUrl }
      : { servedBy: "manual", url: null },
    displayName: file.displayName || file.fileName,
    releaseType: RELEASE_TYPES[file.releaseType ?? 1] ?? "release",
    publishedAt: file.fileDate,
    gameVersions: file.gameVersions.filter((entry) =>
      GAME_VERSION_PATTERN.test(entry),
    ),
    loaders: file.gameVersions
      .map((entry) => entry.toLowerCase())
      .filter((entry): entry is LauncherContentLoader =>
        LOADER_NAMES.has(entry),
      ),
    dependencies: file.dependencies.map((dependency) => ({
      source: "curseforge",
      projectId: String(dependency.projectId),
      required: dependency.required,
    })),
  };
}
