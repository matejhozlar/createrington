import { Q, type db } from "@/db";
import { BadRequestError, ConflictError } from "@/app/middleware/error-handler";
import { UniqueViolationError, DatabaseError } from "@/db/utils/errors";
import type {
  Workshop,
  WorkshopMod,
  WorkshopModCreate,
  WorkshopModStatus,
} from "@createrington/shared/db";
import { WORKSHOP_ADMIN_EXTRA_CLASSES } from "@createrington/shared/workshop";
import { CurseForgeClass } from "@/services/curseforge/client";
import type { CurseForgeProjectData } from "@/services/curseforge/mods";
import { getModpackModIds } from "@/services/curseforge/modpack-manifest";
import { ingestProjects } from "@/services/curseforge/ingest";

export interface WorkshopModEntry {
  projectId: number;
  note?: string;
}

interface PreparedEntry {
  projectId: number;
  note: string | null;
  fileId: number | null;
  fileName: string | null;
  fileReleaseType: number | null;
}

export type TxQueries = Parameters<Parameters<typeof db.inTransaction>[0]>[0];

interface CreateModOptions {
  submittedBy: string;
  status?: WorkshopModStatus;
  reviewedBy?: string;
}

export function addableClasses(workshop: Workshop): Set<number> {
  return workshop.classId === CurseForgeClass.mods
    ? new Set([workshop.classId, ...WORKSHOP_ADMIN_EXTRA_CLASSES])
    : new Set([workshop.classId]);
}

/**
 * Run every submit-time guard over the requested projects and return
 * entries carrying the file snapshot for the workshop's target.
 */
export async function prepareEntries(
  workshop: Workshop,
  entries: WorkshopModEntry[],
  allowedClasses: ReadonlySet<number> = new Set([workshop.classId]),
): Promise<PreparedEntry[]> {
  if (entries.length === 0) return [];

  const projectIds = entries.map((e) => e.projectId);
  if (new Set(projectIds).size !== projectIds.length) {
    throw new BadRequestError("The request contains duplicate mods");
  }

  const [claims, packClaims] = await Promise.all([
    Q.workshop.mod.findAll({
      workshopId: workshop.id,
      curseforgeProjectId: { $in: projectIds },
    }),
    Q.modpack.mod.findAll({
      modpackId: workshop.modpackId,
      curseforgeProjectId: { $in: projectIds },
    }),
  ]);
  const rejectedClaims = claims.filter((c) => c.status === "rejected");
  if (rejectedClaims.length > 0) {
    const labels = await projectLabels(
      rejectedClaims.map((c) => c.curseforgeProjectId),
    );
    throw new BadRequestError(
      `Rejected in this workshop: ${labels.join(", ")}`,
    );
  }
  if (claims.length > 0) {
    const labels = await projectLabels(
      claims.map((c) => c.curseforgeProjectId),
    );
    throw new ConflictError(
      `Already suggested in this workshop: ${labels.join(", ")}`,
    );
  }
  if (packClaims.length > 0) {
    const labels = await projectLabels(
      packClaims.map((c) => c.curseforgeProjectId),
    );
    throw new ConflictError(`Already in the pack: ${labels.join(", ")}`);
  }

  if (workshop.baseModpackProjectId) {
    let basePackIds: Set<number>;
    try {
      basePackIds = await getModpackModIds(workshop.baseModpackProjectId);
    } catch (error) {
      logger.warn("Base modpack manifest fetch failed", error);
      throw new BadRequestError(
        "Could not check against the base modpack right now, please try again",
      );
    }
    const inPack = projectIds.filter((id) => basePackIds.has(id));
    if (inPack.length > 0) {
      const labels = await projectLabels(inPack);
      throw new BadRequestError(
        `Already part of the base modpack: ${labels.join(", ")}`,
      );
    }
  }

  let projectData: Map<number, CurseForgeProjectData>;
  try {
    projectData = await ingestProjects(projectIds);
  } catch (error) {
    if (error instanceof DatabaseError) throw error;
    logger.warn("CurseForge project ingest failed:", error);
    throw new BadRequestError(
      "Could not reach CurseForge right now, please try again",
    );
  }

  const prepared: PreparedEntry[] = [];
  for (const entry of entries) {
    const data = projectData.get(entry.projectId);
    if (!data) {
      throw new BadRequestError(
        `Could not resolve CurseForge project #${entry.projectId}`,
      );
    }
    if (!allowedClasses.has(data.classId)) {
      throw new BadRequestError(
        `"${data.name}" is not the right kind of CurseForge project for this workshop`,
      );
    }
    prepared.push({
      projectId: entry.projectId,
      note: entry.note ?? null,
      ...snapshotFile(workshop, data),
    });
  }
  return prepared;
}

/** Pick the latest compatible file for the workshop's game version and loader. */
function snapshotFile(
  workshop: Workshop,
  data: CurseForgeProjectData,
): Omit<PreparedEntry, "projectId" | "note"> {
  let index = data.latestFilesIndexes.find(
    (idx) =>
      idx.gameVersion === workshop.gameVersion &&
      idx.modLoader === workshop.modLoaderType,
  );
  if (!index && data.classId !== CurseForgeClass.mods) {
    index = data.latestFilesIndexes.find(
      (idx) => idx.gameVersion === workshop.gameVersion,
    );
  }
  if (!index) {
    throw new BadRequestError(
      data.classId === CurseForgeClass.mods
        ? `"${data.name}" has no file for ${workshop.gameVersion} with the workshop's mod loader`
        : `"${data.name}" has no file for ${workshop.gameVersion}`,
    );
  }

  return {
    fileId: index.fileId,
    fileName: index.filename,
    fileReleaseType: index.releaseType,
  };
}

export async function createMod(
  tx: TxQueries,
  workshop: Workshop,
  entry: PreparedEntry,
  options: CreateModOptions,
): Promise<WorkshopMod> {
  return tx.workshop.mod.createAndReturn(toModCreate(workshop, entry, options));
}

export async function createMods(
  tx: TxQueries,
  workshop: Workshop,
  entries: PreparedEntry[],
  options: CreateModOptions,
): Promise<WorkshopMod[]> {
  return tx.workshop.mod.createManyAndReturn(
    entries.map((entry) => toModCreate(workshop, entry, options)),
  );
}

function toModCreate(
  workshop: Workshop,
  entry: PreparedEntry,
  options: CreateModOptions,
): WorkshopModCreate {
  const reviewedBy = options.reviewedBy ?? null;
  return {
    workshopId: workshop.id,
    curseforgeProjectId: entry.projectId,
    submittedBy: options.submittedBy,
    status: options.status ?? "pending",
    note: entry.note,
    reviewedBy,
    reviewedAt: reviewedBy ? new Date() : null,
    fileId: entry.fileId,
    fileName: entry.fileName,
    fileReleaseType: entry.fileReleaseType,
  };
}

async function projectLabels(projectIds: number[]): Promise<string[]> {
  const unique = [...new Set(projectIds)];
  const projects = await Q.curseforge.project.findAll({
    id: { $in: unique },
  });
  const byId = new Map(projects.map((p) => [p.id, p.name]));
  return unique.map((id) => byId.get(id) ?? `#${id}`);
}

export function mapConstraintError(error: unknown): never {
  if (error instanceof UniqueViolationError) {
    throw new ConflictError(
      "Already suggested or ruled out in this workshop, refresh and try again",
    );
  }
  throw error;
}
