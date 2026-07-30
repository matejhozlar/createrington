import { Q } from "@/db";
import type { CurseForgeProjectData } from "@/services/curseforge";
import type {
  Workshop,
  WorkshopCreate,
  WorkshopMod,
  WorkshopModCreate,
} from "@createrington/shared/db";

export const GAME_VERSION = "1.21.1";
export const MOD_LOADER_TYPE = 6;

export interface WorkshopTestContext {
  workshopIds: number[];
  projectIds: number[];
  nextProjectId: number;
  nextSlug: number;
}

export function createWorkshopTestContext(
  projectIdBase: number,
): WorkshopTestContext {
  return {
    workshopIds: [],
    projectIds: [],
    nextProjectId: projectIdBase,
    nextSlug: 0,
  };
}

export async function seedWorkshop(
  ctx: WorkshopTestContext,
  overrides: Partial<WorkshopCreate> = {},
): Promise<Workshop> {
  const workshop = await Q.workshop.createAndReturn({
    name: "Vitest Workshop",
    slug: `vitest-workshop-${Date.now()}-${ctx.nextSlug++}`,
    status: "open",
    gameVersion: GAME_VERSION,
    modLoaderType: MOD_LOADER_TYPE,
    createdBy: "999900000000000000",
    ...overrides,
  });
  ctx.workshopIds.push(workshop.id);
  return workshop;
}

export async function seedProject(
  ctx: WorkshopTestContext,
  name?: string,
): Promise<number> {
  const id = ctx.nextProjectId++;
  await Q.curseforge.project.create({
    id,
    classId: 6,
    slug: `vitest-mod-${id}`,
    name: name ?? `Vitest Mod ${id}`,
  });
  ctx.projectIds.push(id);
  return id;
}

export async function seedMod(
  ctx: WorkshopTestContext,
  workshop: Workshop,
  overrides: Partial<WorkshopModCreate> = {},
): Promise<WorkshopMod> {
  const curseforgeProjectId =
    overrides.curseforgeProjectId ?? (await seedProject(ctx));
  return Q.workshop.mod.createAndReturn({
    workshopId: workshop.id,
    submittedBy: "999900000000000009",
    ...overrides,
    curseforgeProjectId,
  });
}

export async function seedRequiredDependency(
  workshopModId: number,
  curseforgeProjectId: number,
): Promise<void> {
  await Q.workshop.mod.dependency.create({
    workshopModId,
    curseforgeProjectId,
    relationType: 3,
  });
}

export async function cleanupWorkshopTestContext(
  ctx: WorkshopTestContext,
): Promise<void> {
  if (ctx.workshopIds.length > 0) {
    await Q.workshop.deleteAll({ id: { $in: ctx.workshopIds } });
  }
  if (ctx.projectIds.length > 0) {
    await Q.curseforge.project.deleteAll({ id: { $in: ctx.projectIds } });
  }
  ctx.workshopIds.length = 0;
  ctx.projectIds.length = 0;
}

export function makeProjectData(
  projectId: number,
  overrides: Partial<CurseForgeProjectData> = {},
): CurseForgeProjectData {
  return {
    id: projectId,
    classId: 6,
    slug: `vitest-mod-${projectId}`,
    name: `Vitest Mod ${projectId}`,
    summary: "A synthetic test project",
    websiteUrl: `https://www.curseforge.com/minecraft/mc-mods/vitest-mod-${projectId}`,
    thumbnailUrl: null,
    authors: [{ id: 1, name: "vitest", url: "https://example.com" }],
    categories: [],
    screenshots: [],
    downloadCount: 0,
    isAvailable: true,
    allowModDistribution: true,
    dateModified: new Date().toISOString(),
    dateReleased: new Date().toISOString(),
    latestFilesIndexes: [
      {
        gameVersion: GAME_VERSION,
        fileId: projectId + 1,
        filename: `vitest-mod-${projectId}.jar`,
        releaseType: 1,
        modLoader: MOD_LOADER_TYPE,
      },
    ],
    ...overrides,
  };
}
