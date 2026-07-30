import { Q } from "@/db";
import type { CurseForgeProjectData } from "@/services/curseforge";
import type {
  Vote,
  VoteCreate,
  VoteMod,
  VoteModCreate,
} from "@createrington/shared/db";

export const GAME_VERSION = "1.21.1";
export const MOD_LOADER_TYPE = 6;

export interface VoteTestContext {
  voteIds: number[];
  projectIds: number[];
  nextProjectId: number;
  nextSlug: number;
}

export function createVoteTestContext(projectIdBase: number): VoteTestContext {
  return {
    voteIds: [],
    projectIds: [],
    nextProjectId: projectIdBase,
    nextSlug: 0,
  };
}

export async function seedVote(
  ctx: VoteTestContext,
  overrides: Partial<VoteCreate> = {},
): Promise<Vote> {
  const vote = await Q.vote.createAndReturn({
    name: "Vitest Workshop",
    slug: `vitest-workshop-${Date.now()}-${ctx.nextSlug++}`,
    status: "open",
    gameVersion: GAME_VERSION,
    modLoaderType: MOD_LOADER_TYPE,
    createdBy: "999900000000000000",
    ...overrides,
  });
  ctx.voteIds.push(vote.id);
  return vote;
}

export async function seedProject(
  ctx: VoteTestContext,
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
  ctx: VoteTestContext,
  vote: Vote,
  overrides: Partial<VoteModCreate> = {},
): Promise<VoteMod> {
  const curseforgeProjectId =
    overrides.curseforgeProjectId ?? (await seedProject(ctx));
  return Q.vote.mod.createAndReturn({
    voteId: vote.id,
    submittedBy: "999900000000000009",
    ...overrides,
    curseforgeProjectId,
  });
}

export async function seedRequiredDependency(
  voteModId: number,
  curseforgeProjectId: number,
): Promise<void> {
  await Q.vote.mod.dependency.create({
    voteModId,
    curseforgeProjectId,
    relationType: 3,
  });
}

export async function cleanupVoteTestContext(
  ctx: VoteTestContext,
): Promise<void> {
  if (ctx.voteIds.length > 0) {
    await Q.vote.deleteAll({ id: { $in: ctx.voteIds } });
  }
  if (ctx.projectIds.length > 0) {
    await Q.curseforge.project.deleteAll({ id: { $in: ctx.projectIds } });
  }
  ctx.voteIds.length = 0;
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
