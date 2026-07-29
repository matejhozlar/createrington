import { Q } from "@/db";
import { ConstraintViolationError } from "@/db/utils/errors";
import type { Vote, VoteMod } from "@createrington/shared/db";
import {
  getFilesDependencies,
  getMods,
  getModpackModIds,
  type CurseForgeProjectData,
} from "@/services/curseforge";
import { refreshProjects } from "@/services/curseforge/ingest";

export const OPTIONAL_DEPENDENCY = 2;
export const REQUIRED_DEPENDENCY = 3;

/**
 * Resolve and store the dependencies of the given mods' chosen files. Batch
 * CurseForge calls only; deps satisfied by the base modpack are not stored.
 * Never throws, failures are logged and retried by the daily sweep.
 */
export async function resolveModDependencies(
  vote: Vote,
  mods: VoteMod[],
): Promise<void> {
  try {
    const withFile = mods.filter((mod) => mod.fileId !== null);
    if (withFile.length === 0) return;

    const fileDeps = await getFilesDependencies(
      withFile.map((mod) => mod.fileId!),
    );
    const depsByFile = new Map(
      fileDeps.map((file) => [file.fileId, file.dependencies]),
    );

    let basePackIds = new Set<number>();
    if (vote.baseModpackProjectId) {
      try {
        basePackIds = await getModpackModIds(vote.baseModpackProjectId);
      } catch {
        // Without the manifest some base-pack deps get stored; the next
        // sweep clears them
      }
    }

    const allDepIds = [
      ...new Set(
        withFile.flatMap((mod) =>
          (depsByFile.get(mod.fileId!) ?? [])
            .map((dep) => dep.modId)
            .filter((id) => !basePackIds.has(id)),
        ),
      ),
    ];
    if (allDepIds.length > 0) await refreshProjects(allDepIds);
    const cached =
      allDepIds.length > 0
        ? await Q.curseforge.project.findAll(
            { id: { $in: allDepIds } },
            { select: ["id"] },
          )
        : [];
    const cachedIds = new Set(cached.map((project) => project.id));

    for (const mod of withFile) {
      const deps = (depsByFile.get(mod.fileId!) ?? []).filter(
        (dep) => !basePackIds.has(dep.modId) && cachedIds.has(dep.modId),
      );
      await Q.vote.mod.dependency.deleteAll({ voteModId: mod.id });
      for (const dep of deps) {
        await Q.vote.mod.dependency.create({
          voteModId: mod.id,
          curseforgeProjectId: dep.modId,
          relationType: dep.relationType,
        });
      }
    }
  } catch (error) {
    logger.warn(`Dependency resolution failed: ${error}`);
  }
}

/**
 * Auto-add the missing required dependencies of an approved mod as approved
 * 'dependency'-sourced entries, recording which mod pulled them in. Banned,
 * claimed, and incompatible dependencies are skipped with a warning.
 * Never throws.
 */
export async function promoteRequiredDependencies(
  vote: Vote,
  mod: VoteMod,
  actorId: string,
): Promise<void> {
  try {
    let deps = await Q.vote.mod.dependency.findAll({
      voteModId: mod.id,
      relationType: REQUIRED_DEPENDENCY,
    });
    if (deps.length === 0 && mod.fileId !== null) {
      await resolveModDependencies(vote, [mod]);
      deps = await Q.vote.mod.dependency.findAll({
        voteModId: mod.id,
        relationType: REQUIRED_DEPENDENCY,
      });
    }
    if (deps.length === 0) return;

    const depIds = deps.map((dep) => dep.curseforgeProjectId);
    const [bans, claims] = await Promise.all([
      Q.vote.mod.ban.findAll({ curseforgeProjectId: { $in: depIds } }),
      Q.vote.mod.findAll({
        voteId: vote.id,
        curseforgeProjectId: { $in: depIds },
        status: { $in: ["pending", "approved"] },
      }),
    ]);
    const bannedIds = new Set(bans.map((ban) => ban.curseforgeProjectId));
    const claimedIds = new Set(
      claims.map((claim) => claim.curseforgeProjectId),
    );
    for (const id of bannedIds) {
      logger.warn(
        `Required dependency #${id} of vote mod #${mod.id} is banned and cannot ship`,
      );
    }

    const missing = depIds.filter(
      (id) => !bannedIds.has(id) && !claimedIds.has(id),
    );
    if (missing.length === 0) return;

    const projects = await getMods(missing);
    const created: VoteMod[] = [];
    for (const data of projects) {
      if (data.classId !== vote.classId) {
        logger.warn(
          `Required dependency "${data.name}" is not the right kind of project, skipped`,
        );
        continue;
      }
      const file = pickCompatibleFile(vote, data);
      if (!file) {
        logger.warn(
          `Required dependency "${data.name}" has no file for ${vote.gameVersion}, skipped`,
        );
        continue;
      }
      try {
        const row = await Q.vote.mod.createAndReturn({
          voteId: vote.id,
          curseforgeProjectId: data.id,
          source: "dependency",
          submittedBy: actorId,
          status: "approved",
          note: null,
          reviewedBy: actorId,
          reviewedAt: new Date(),
          fileId: file.fileId,
          fileName: file.filename,
          fileReleaseType: file.releaseType,
          pulledByVoteModId: mod.id,
        });
        created.push(row);
      } catch (error) {
        if (!(error instanceof ConstraintViolationError)) throw error;
      }
    }
    if (created.length > 0) {
      logger.info(
        `Pulled ${created.length} required dependencies into vote #${vote.id}`,
      );
      await resolveModDependencies(vote, created);
    }
  } catch (error) {
    logger.warn(`Dependency promotion failed for mod #${mod.id}: ${error}`);
  }
}

// Deps prefer the vote's exact loader but fall back to any file for the game
// version: the chosen file is re-resolved at pack build time anyway
function pickCompatibleFile(vote: Vote, data: CurseForgeProjectData) {
  return (
    data.latestFilesIndexes.find(
      (idx) =>
        idx.gameVersion === vote.gameVersion &&
        idx.modLoader === vote.modLoaderType,
    ) ??
    data.latestFilesIndexes.find(
      (idx) => idx.gameVersion === vote.gameVersion,
    ) ??
    null
  );
}
