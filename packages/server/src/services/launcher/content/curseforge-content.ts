import type {
  CurseforgeFileProject,
  CurseforgeFileWithProject,
} from "@/db/queries/curseforge/file";
import type {
  LauncherContentFile,
  LauncherContentKind,
  LauncherProject,
} from "@createrington/shared/launcher";
import { CURSEFORGE_CLASSES } from "@createrington/shared/workshop";

const CURSEFORGE_SITE = "https://www.curseforge.com/minecraft";

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

type ProjectPage = Pick<
  CurseforgeFileProject,
  "websiteUrl" | "classId" | "slug"
>;

export function contentKindForClass(
  classId: number,
): LauncherContentKind | null {
  return CONTENT_CLASSES[classId]?.kind ?? null;
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
