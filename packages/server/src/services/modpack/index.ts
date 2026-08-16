import { Q, db } from "@/db";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@/app/middleware/error-handler";
import { ConstraintViolationError } from "@/db/utils/errors";
import type {
  CurseforgeProject,
  Modpack,
  ModpackMod,
  ModpackRelease,
  Workshop,
  WorkshopMod,
  WorkshopModStatus,
} from "@createrington/shared/db";
import type { ReleaseModRow } from "@/db/queries/modpack/release/mod";
import {
  CurseForgeClass,
  CurseForgeLoader,
  getMod,
  getFilesDetails,
  getModpackManifest,
  type CurseForgeProjectData,
  type ModpackManifest,
} from "@/services/curseforge";
import { refreshProjects } from "@/services/curseforge/ingest";
import {
  REQUIRED_DEPENDENCY,
  loadDependencyContext,
  type DependencyCoverage,
} from "@/services/workshop/dependencies";
import {
  announcePackDropOut,
  announceReview,
} from "@/services/workshop/discord";
import { recordModEvent } from "@/services/workshop/events";

const SHIP_CLAIMABLE_STATUSES: WorkshopModStatus[] = [
  "pending",
  "approved",
  "testing",
  "next_update",
];

export type ModpackProjectSummary = Pick<
  CurseforgeProject,
  | "id"
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

export interface ModpackModListItem extends ModpackMod {
  project: ModpackProjectSummary;
  suggestedByName: string | null;
  upvoteCount: number | null;
  requiredBy: Array<{ curseforgeProjectId: number; name: string }>;
  suggestionWorkshopId: number | null;
  suggestionWorkshopName: string | null;
}

export type ModpackListItem = Modpack & {
  modCount: number;
  liveCount: number;
  workshops: Array<Pick<Workshop, "id" | "name" | "slug" | "status">>;
};

/**
 * Post pipeline moves to their threads off the caller's path: reconcile runs
 * from an admin mutation, and a pack's worth of posts would both stall that
 * request and hit Discord in one burst. Sequential so the rate limiter paces
 * itself; the announce helpers swallow their own errors.
 */
function announceStatusMoves(mods: WorkshopMod[]): void {
  if (mods.length === 0) return;
  void (async () => {
    for (const mod of mods) {
      await (mod.status === "in_pack"
        ? announceReview(mod, "in_pack")
        : announcePackDropOut(mod));
    }
  })();
}

export interface ModpackReleaseDiffEntry extends ReleaseModRow {
  previousFile: ReleaseModRow | null;
}

type ManifestMembership = Pick<ModpackManifest, "modIds" | "version">;

export interface ModpackManifestSeed {
  version: string | null;
  minecraftVersion: string | null;
  modLoader: string | null;
  modIds: number[];
}

export interface ModpackSeedResult {
  modCount: number;
  memberCount: number;
  unresolvedProjectIds: number[];
  duplicateProjectIds: number[];
}

function manifestLoaderType(loaderId: string): number | null {
  const prefix = loaderId.split("-")[0]?.toLowerCase() ?? "";
  return Object.hasOwn(CurseForgeLoader, prefix)
    ? CurseForgeLoader[prefix as keyof typeof CurseForgeLoader]
    : null;
}

function groupByProject(
  rows: ReleaseModRow[],
): Map<number, [ReleaseModRow, ...ReleaseModRow[]]> {
  const grouped = new Map<number, [ReleaseModRow, ...ReleaseModRow[]]>();
  for (const row of rows) {
    const held = grouped.get(row.curseforgeProjectId);
    if (held) held.push(row);
    else grouped.set(row.curseforgeProjectId, [row]);
  }
  for (const files of grouped.values()) {
    files.sort((a, b) => a.fileId - b.fileId);
  }
  return grouped;
}

function firstPerProject<T extends { curseforgeProjectId: number }>(
  rows: T[],
): T[] {
  const held = new Map<number, T>();
  for (const row of rows) {
    if (!held.has(row.curseforgeProjectId)) {
      held.set(row.curseforgeProjectId, row);
    }
  }
  return [...held.values()];
}

function sameFiles(a: ReleaseModRow[], b: ReleaseModRow[]): boolean {
  return (
    a.length === b.length &&
    a.every((row, index) => row.fileId === b[index].fileId)
  );
}

export interface ModpackReleaseDiff {
  release: ModpackRelease;
  previous: ModpackRelease | null;
  added: ModpackReleaseDiffEntry[];
  updated: ModpackReleaseDiffEntry[];
  removed: ModpackReleaseDiffEntry[];
  unchanged: number;
}

interface AttentionSubject {
  curseforgeProjectId: number;
  name: string;
  websiteUrl: string | null;
}

export type ModpackAttentionItem =
  | (AttentionSubject & {
      type: "dropped_from_pack";
      modpackModId: number;
      droppedAt: Date;
    })
  | (AttentionSubject & {
      type: "shipped_unreviewed";
      workshopModId: number;
    })
  | (AttentionSubject & {
      type: "shipped_rejected";
      workshopModId: number;
    })
  | (AttentionSubject & {
      type: "rejected_dependency" | "unpromoted_dependency";
      workshopModId: number;
      requiredByName: string;
    })
  | (AttentionSubject & {
      type: "environment_unspecified";
      workshopModId: number | null;
    })
  | (AttentionSubject & {
      type: "duplicate_manifest_entry";
    });

/**
 * The durable pack artifact workshops feed into. Membership rows track how
 * each mod entered the pack; live state is derived from the published
 * CurseForge pack's manifest by reconcile, never set by hand.
 */
export class ModpackService {
  /** All modpacks with member counts and attached workshops, for the admin panel. */
  async listModpacks(): Promise<ModpackListItem[]> {
    const [modpacks, workshops] = await Promise.all([
      Q.modpack.findAll({}, { orderBy: "createdAt", orderDirection: "desc" }),
      Q.workshop.findAll(
        {},
        { select: ["id", "name", "slug", "status", "modpackId"] },
      ),
    ]);
    return Promise.all(
      modpacks.map(async (modpack) => {
        const rows = await Q.modpack.mod.findAll(
          { modpackId: modpack.id },
          { select: ["id", "liveAt"] },
        );
        return {
          ...modpack,
          modCount: rows.length,
          liveCount: rows.filter((row) => row.liveAt !== null).length,
          workshops: workshops
            .filter((workshop) => workshop.modpackId === modpack.id)
            .map(({ id, name, slug, status }) => ({ id, name, slug, status })),
        };
      }),
    );
  }

  /** A modpack by id; throws when missing. */
  async getModpack(modpackId: number): Promise<Modpack> {
    const modpack = await Q.modpack.find({ id: modpackId });
    if (!modpack) throw new NotFoundError(`Modpack #${modpackId} not found`);
    return modpack;
  }

  /** Create a modpack; the CurseForge project can be linked later at first publish. */
  async createModpack(
    input: {
      name: string;
      description?: string | null;
      curseforgeProjectId?: number | null;
      serverId?: number | null;
    },
    adminId: string,
  ): Promise<Modpack> {
    if (input.curseforgeProjectId) {
      await this.assertModpackProject(input.curseforgeProjectId);
    }
    if (input.serverId) await this.assertServer(input.serverId);
    try {
      return await Q.modpack.createAndReturn({
        name: input.name,
        description: input.description ?? null,
        curseforgeProjectId: input.curseforgeProjectId ?? null,
        serverId: input.serverId ?? null,
        createdBy: adminId,
      });
    } catch (error) {
      throw this.mapProjectConflict(error);
    }
  }

  /**
   * Update modpack fields. Linking the published CurseForge project for the
   * first time kicks off an immediate reconcile.
   */
  async updateModpack(
    modpackId: number,
    patch: Partial<{
      name: string;
      description: string | null;
      curseforgeProjectId: number | null;
      serverId: number | null;
    }>,
  ): Promise<Modpack> {
    const modpack = await this.getModpack(modpackId);
    if (
      patch.curseforgeProjectId &&
      patch.curseforgeProjectId !== modpack.curseforgeProjectId
    ) {
      await this.assertModpackProject(patch.curseforgeProjectId);
    }
    if (patch.serverId) await this.assertServer(patch.serverId);

    let updated: Modpack;
    try {
      updated = await Q.modpack.updateAndReturn({ id: modpackId }, patch);
    } catch (error) {
      throw this.mapProjectConflict(error);
    }
    if (
      updated.curseforgeProjectId &&
      updated.curseforgeProjectId !== modpack.curseforgeProjectId
    ) {
      void this.tryReconcile(modpackId);
    }
    return updated;
  }

  /**
   * Delete a modpack together with its members and release history. Refused
   * while any workshop, archived ones included, still points at it. Returns
   * counts of what was destroyed for the audit trail.
   */
  async deleteModpack(
    modpackId: number,
  ): Promise<{ modpack: Modpack; modCount: number; releaseCount: number }> {
    const modpack = await this.getModpack(modpackId);
    const workshops = await Q.workshop.findAll(
      { modpackId },
      { select: ["name"] },
    );
    if (workshops.length > 0) {
      const names = workshops.map((w) => `"${w.name}"`).join(", ");
      throw new ConflictError(
        `${workshops.length} workshop(s) still use this modpack: ${names}. Delete those workshops first.`,
      );
    }
    const [modCount, releaseCount] = await Promise.all([
      Q.modpack.mod.count({ modpackId }),
      Q.modpack.release.count({ modpackId }),
    ]);
    try {
      await Q.modpack.delete({ id: modpack.id });
    } catch (error) {
      if (error instanceof ConstraintViolationError) {
        throw new ConflictError(
          "A workshop was attached to this modpack while it was being deleted",
        );
      }
      throw error;
    }
    return { modpack, modCount, releaseCount };
  }

  /** Members of a modpack with project summaries, credit, and live state. */
  async getPackMods(modpackId: number): Promise<ModpackModListItem[]> {
    await this.getModpack(modpackId);
    const rows = await Q.modpack.mod.findAll(
      { modpackId },
      { orderBy: "createdAt", orderDirection: "asc" },
    );
    return this.decoratePackMods(modpackId, rows);
  }

  /** The published pack's CurseForge page URL, when a project is linked. */
  async getPackCurseforgeUrl(modpack: Modpack): Promise<string | null> {
    if (!modpack.curseforgeProjectId) return null;
    let cached = await Q.curseforge.project.find({
      id: modpack.curseforgeProjectId,
    });
    if (!cached) {
      try {
        await refreshProjects([modpack.curseforgeProjectId]);
      } catch {
        return null;
      }
      cached = await Q.curseforge.project.find({
        id: modpack.curseforgeProjectId,
      });
    }
    return cached?.websiteUrl ?? null;
  }

  /**
   * Bring membership in line with the published pack: every mod the manifest
   * lists gets a row classified by where it came from, suggestions move in and
   * out of in_pack to match, and mods the latest publish dropped are flagged.
   * Membership is never written anywhere else, so a row means published.
   */
  async reconcile(modpackId: number): Promise<void> {
    const modpack = await this.getModpack(modpackId);
    if (!modpack.curseforgeProjectId) return;

    const workshops = await Q.workshop.findAll({ modpackId });
    const manifest = await getModpackManifest(modpack.curseforgeProjectId);
    await this.applyManifest(modpack, workshops, manifest);
    await this.recordRelease(modpack, manifest);
  }

  /**
   * Seed membership from an uploaded manifest.json while the pack has no
   * published CurseForge project. Runs the same sync as reconcile, so repeat
   * imports move suggestions in both directions; once a project is linked,
   * the published manifest is the source of truth and seeding is refused.
   * Manifest entries that cannot be resolved on CurseForge are skipped and
   * reported back.
   */
  async seedFromManifest(
    modpackId: number,
    seed: ModpackManifestSeed,
  ): Promise<ModpackSeedResult> {
    const modpack = await this.getModpack(modpackId);
    if (modpack.curseforgeProjectId) {
      throw new BadRequestError(
        "This modpack follows a published CurseForge project, use Check Published Pack instead",
      );
    }

    const workshops = await Q.workshop.findAll({ modpackId });
    this.assertSeedTarget(workshops, seed);

    const modIds = new Set<number>();
    const duplicateProjectIds = new Set<number>();
    for (const projectId of seed.modIds) {
      if (modIds.has(projectId)) duplicateProjectIds.add(projectId);
      modIds.add(projectId);
    }
    await this.applyManifest(modpack, workshops, {
      modIds,
      version: seed.version,
    });

    // Members dropped by an earlier seed keep their rows, so the count of
    // what this manifest covers is derived from the manifest side
    const rows = await Q.modpack.mod.findAll(
      { modpackId },
      { select: ["curseforgeProjectId"] },
    );
    const memberIds = new Set(rows.map((row) => row.curseforgeProjectId));
    const unresolvedProjectIds = [...modIds].filter((id) => !memberIds.has(id));
    return {
      modCount: modIds.size,
      memberCount: modIds.size - unresolvedProjectIds.length,
      unresolvedProjectIds,
      duplicateProjectIds: [...duplicateProjectIds],
    };
  }

  private assertSeedTarget(
    workshops: Workshop[],
    seed: Pick<ModpackManifestSeed, "minecraftVersion" | "modLoader">,
  ): void {
    if (workshops.length === 0) return;
    if (
      seed.minecraftVersion &&
      !workshops.some((w) => w.gameVersion === seed.minecraftVersion)
    ) {
      const versions = [...new Set(workshops.map((w) => w.gameVersion))];
      throw new BadRequestError(
        `The manifest targets Minecraft ${seed.minecraftVersion}, but this pack's workshops target ${versions.join(", ")}`,
      );
    }
    if (!seed.modLoader) return;
    const loaderType = manifestLoaderType(seed.modLoader);
    if (
      loaderType !== null &&
      !workshops.some((w) => w.modLoaderType === loaderType)
    ) {
      throw new BadRequestError(
        `The manifest uses ${seed.modLoader}, which does not match this pack's mod loader`,
      );
    }
  }

  /** Recorded releases of a modpack, newest first. */
  async listReleases(modpackId: number): Promise<ModpackRelease[]> {
    return Q.modpack.release.findAll(
      { modpackId },
      { orderBy: "id", orderDirection: "desc" },
    );
  }

  /**
   * What a release changed against the one before it. Both sides are read from
   * frozen rows, so this keeps working after CurseForge archives the files.
   */
  async getReleaseDiff(releaseId: number): Promise<ModpackReleaseDiff> {
    const release = await Q.modpack.release.get({ id: releaseId });
    const [previous] = await Q.modpack.release.findAll(
      { modpackId: release.modpackId, id: { $lt: release.id } },
      { orderBy: "id", orderDirection: "desc", limit: 1 },
    );

    const rows = await Q.modpack.release.mod.listForReleases(
      previous ? [release.id, previous.id] : [release.id],
    );
    // A manifest may ship a project as several files, so a project counts as
    // changed when its whole set of files does, not when one row differs
    const before = groupByProject(
      rows.filter((row) => row.releaseId === previous?.id),
    );
    const current = groupByProject(
      rows.filter((row) => row.releaseId === release.id),
    );

    const added: ModpackReleaseDiffEntry[] = [];
    const updated: ModpackReleaseDiffEntry[] = [];
    let unchanged = 0;
    for (const [projectId, files] of current) {
      const prior = before.get(projectId);
      if (!prior) {
        if (previous) added.push({ ...files[0], previousFile: null });
        else unchanged++;
        continue;
      }
      if (sameFiles(prior, files)) {
        unchanged++;
        continue;
      }
      updated.push({ ...files[0], previousFile: prior[0] });
    }

    const removed: ModpackReleaseDiffEntry[] = [...before]
      .filter(([projectId]) => !current.has(projectId))
      .map(([, files]) => ({ ...files[0], previousFile: null }));

    return {
      release,
      previous: previous ?? null,
      added,
      updated,
      removed,
      unchanged,
    };
  }

  /** Frozen membership of a recorded release, joined to cached project summaries. */
  async getReleaseMods(releaseId: number): Promise<ReleaseModRow[]> {
    const release = await Q.modpack.release.get({ id: releaseId });
    const rows = await Q.modpack.release.mod.listForReleases([release.id]);
    return rows.map(({ releaseId: _releaseId, ...row }) => row);
  }

  /**
   * Freeze what a published pack file shipped. CurseForge stops serving files
   * once they are archived, so every column a diff needs is copied in here and
   * nothing in the history path ever reads CurseForge again.
   */
  private async recordRelease(
    modpack: Modpack,
    manifest: ModpackManifest,
  ): Promise<void> {
    if (manifest.entries.length === 0) return;
    const recorded = await Q.modpack.release.find({
      modpackId: modpack.id,
      curseforgeFileId: manifest.fileId,
    });
    if (recorded) return;

    const projectIds = [...new Set(manifest.entries.map((e) => e.projectId))];
    const cached = new Set(
      (
        await Q.curseforge.project.findAll(
          { id: { $in: projectIds } },
          { select: ["id"] },
        )
      ).map((project) => project.id),
    );
    // A manifest can repeat a (project, file) pair, which the unique index
    // would reject and take the whole release down with it
    const seen = new Set<string>();
    const entries = manifest.entries.filter((entry) => {
      if (!cached.has(entry.projectId)) return false;
      const key = `${entry.projectId}:${entry.fileId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (entries.length === 0) return;

    const details = new Map(
      (await getFilesDetails(entries.map((e) => e.fileId))).map((detail) => [
        detail.fileId,
        detail,
      ]),
    );

    const rows = entries.map((entry) => {
      const detail = details.get(entry.fileId);
      return {
        curseforgeProjectId: entry.projectId,
        fileId: entry.fileId,
        fileName: detail?.fileName ?? null,
        displayName: detail?.displayName ?? null,
        fileReleaseType: detail?.releaseType ?? null,
        fileDate: detail?.fileDate ? new Date(detail.fileDate) : null,
      };
    });

    // A half-written release would be permanent: the guard above sees the
    // release row and never repairs the missing membership
    try {
      await db.inTransaction(async (tx) => {
        const release = await tx.modpack.release.createAndReturn({
          modpackId: modpack.id,
          curseforgeFileId: manifest.fileId,
          version: manifest.version,
          displayName: manifest.displayName,
          minecraftVersion: manifest.minecraftVersion,
          modLoader: manifest.modLoader,
          modCount: new Set(rows.map((row) => row.curseforgeProjectId)).size,
          publishedAt: manifest.publishedAt
            ? new Date(manifest.publishedAt)
            : null,
        });
        await tx.modpack.release.mod.insertMany(release.id, rows);
        await tx.modpack.mod.applyManifestFiles(
          modpack.id,
          firstPerProject(rows),
        );
      });
    } catch (error) {
      if (error instanceof ConstraintViolationError) return;
      throw error;
    }

    logger.info(
      `Recorded modpack #${modpack.id} release ${
        manifest.version ?? manifest.fileId
      } with ${entries.length} mods`,
    );
  }

  /** Reconcile variant for sweeps and background kicks: logs failures, never throws. */
  async tryReconcile(modpackId: number): Promise<void> {
    try {
      await this.reconcile(modpackId);
    } catch (error) {
      logger.warn(`Modpack #${modpackId} reconcile failed:`, error);
    }
  }

  /** Items needing an admin decision for a workshop's modpack. */
  async getWorkshopAttention(
    workshop: Workshop,
  ): Promise<ModpackAttentionItem[]> {
    const modpack = await this.getModpack(workshop.modpackId);
    const items: ModpackAttentionItem[] = [];

    const rows = await Q.modpack.mod.findAll({ modpackId: modpack.id });
    const dropped = rows.filter((row) => row.droppedFromManifestAt !== null);
    const active = rows.filter((row) => row.droppedFromManifestAt === null);

    let manifest: ModpackManifest | null = null;
    if (modpack.curseforgeProjectId) {
      try {
        manifest = await getModpackManifest(modpack.curseforgeProjectId);
      } catch {
        manifest = null;
      }
    }

    const suggestions = await Q.workshop.mod.findAll({
      workshopId: workshop.id,
    });

    let shipped: WorkshopMod[] = [];
    const duplicateIds = new Set<number>();
    if (manifest) {
      const { modIds } = manifest;
      shipped = suggestions.filter(
        (mod) =>
          modIds.has(mod.curseforgeProjectId) &&
          mod.status !== "next_update" &&
          mod.status !== "in_pack",
      );
      const seen = new Set<number>();
      for (const entry of manifest.entries) {
        if (seen.has(entry.projectId)) duplicateIds.add(entry.projectId);
        seen.add(entry.projectId);
      }
    }

    // A dependency is only a problem for something that ships, so the gaps are
    // read off the mods staged for the next update and the ones already in
    const context = await loadDependencyContext(workshop);
    const edges = await Q.workshop.project.dependency.findAll({
      workshopId: workshop.id,
      relationType: REQUIRED_DEPENDENCY,
    });
    const suggestionByProject = new Map(
      suggestions.map((mod) => [mod.curseforgeProjectId, mod]),
    );
    // A project can be both a pack member and a live suggestion; the
    // suggestion wins so the item can link through to the mod
    const unclassifiedTargets = new Map<number, number | null>();
    for (const row of active) {
      unclassifiedTargets.set(row.curseforgeProjectId, null);
    }
    for (const mod of suggestions) {
      if (mod.status !== "testing" && mod.status !== "next_update") continue;
      unclassifiedTargets.set(mod.curseforgeProjectId, mod.id);
    }
    const gaps = new Map<
      number,
      { coverage: DependencyCoverage; requiredByProjectId: number }
    >();
    for (const edge of edges) {
      const subject = context.coverage.get(edge.curseforgeProjectId);
      if (subject !== "staged" && subject !== "published") continue;
      const coverage =
        context.coverage.get(edge.dependsOnProjectId) ?? "missing";
      if (coverage === "published" || coverage === "staged") continue;
      if (gaps.has(edge.dependsOnProjectId)) continue;
      gaps.set(edge.dependsOnProjectId, {
        coverage,
        requiredByProjectId: edge.curseforgeProjectId,
      });
    }

    const projectIds = [
      ...new Set([
        ...dropped.map((row) => row.curseforgeProjectId),
        ...unclassifiedTargets.keys(),
        ...shipped.map((mod) => mod.curseforgeProjectId),
        ...duplicateIds,
        ...[...gaps.entries()].flatMap(([depId, gap]) => [
          depId,
          gap.requiredByProjectId,
        ]),
      ]),
    ];
    const projects =
      projectIds.length > 0
        ? await Q.curseforge.project.findAll({ id: { $in: projectIds } })
        : [];
    const projectById = new Map(projects.map((p) => [p.id, p]));
    const label = (id: number) => projectById.get(id)?.name ?? `#${id}`;
    const subject = (id: number): AttentionSubject => ({
      curseforgeProjectId: id,
      name: label(id),
      websiteUrl: projectById.get(id)?.websiteUrl ?? null,
    });

    for (const row of dropped) {
      items.push({
        type: "dropped_from_pack",
        modpackModId: row.id,
        ...subject(row.curseforgeProjectId),
        droppedAt: row.droppedFromManifestAt!,
      });
    }
    for (const mod of shipped) {
      items.push({
        type:
          mod.status === "rejected" ? "shipped_rejected" : "shipped_unreviewed",
        workshopModId: mod.id,
        ...subject(mod.curseforgeProjectId),
      });
    }
    for (const [projectId, gap] of gaps) {
      const suggestion = suggestionByProject.get(projectId);
      if (!suggestion) continue;
      items.push({
        type:
          gap.coverage === "rejected"
            ? "rejected_dependency"
            : "unpromoted_dependency",
        workshopModId: suggestion.id,
        ...subject(projectId),
        requiredByName: label(gap.requiredByProjectId),
      });
    }
    for (const projectId of duplicateIds) {
      items.push({
        type: "duplicate_manifest_entry",
        ...subject(projectId),
      });
    }
    for (const [projectId, workshopModId] of unclassifiedTargets) {
      const project = projectById.get(projectId);
      if (project?.environment !== "unspecified") continue;
      items.push({
        type: "environment_unspecified",
        workshopModId,
        ...subject(projectId),
      });
    }
    return items;
  }

  /** Decorate member rows; public so callers holding a subset can reuse it. */
  async decoratePackMods(
    modpackId: number,
    rows: ModpackMod[],
  ): Promise<ModpackModListItem[]> {
    if (rows.length === 0) return [];

    const projectIds = [...new Set(rows.map((row) => row.curseforgeProjectId))];
    const suggestionIds = rows
      .map((row) => row.workshopModId)
      .filter((id): id is number => id !== null);
    const [workshops, memberRows] = await Promise.all([
      Q.workshop.findAll({ modpackId }, { select: ["id", "name"] }),
      Q.modpack.mod.findAll({ modpackId }, { select: ["curseforgeProjectId"] }),
    ]);
    const workshopNameById = new Map(workshops.map((w) => [w.id, w.name]));

    const [projects, suggestions, upvoteCounts, edges] = await Promise.all([
      Q.curseforge.project.findAll({ id: { $in: projectIds } }),
      suggestionIds.length > 0
        ? Q.workshop.mod.findAll({ id: { $in: suggestionIds } })
        : Promise.resolve([]),
      suggestionIds.length > 0
        ? Q.workshop.mod.upvote.countGroupedByMod(suggestionIds)
        : Promise.resolve({} as Record<number, number>),
      workshops.length > 0
        ? Q.workshop.project.dependency.findAll({
            workshopId: { $in: workshops.map((w) => w.id) },
            dependsOnProjectId: { $in: projectIds },
            relationType: REQUIRED_DEPENDENCY,
          })
        : Promise.resolve([]),
    ]);

    const projectById = new Map(projects.map((p) => [p.id, p]));
    // Requirement context spans the whole pack, not just the rows being
    // decorated, so a partial decorate (e.g. the dependency report) still
    // credits the members that require a pulled dependency
    const memberProjectIds = new Set(
      memberRows.map((row) => row.curseforgeProjectId),
    );
    const subjectIds = [
      ...new Set(edges.map((edge) => edge.curseforgeProjectId)),
    ].filter((id) => !projectById.has(id));
    if (subjectIds.length > 0) {
      const subjectProjects = await Q.curseforge.project.findAll({
        id: { $in: subjectIds },
      });
      for (const project of subjectProjects) {
        projectById.set(project.id, project);
      }
    }
    const suggestionById = new Map(suggestions.map((s) => [s.id, s]));

    const discordIds = [...new Set(suggestions.map((s) => s.submittedBy))];
    const players =
      discordIds.length > 0
        ? await Q.player.findAll({ discordId: { $in: discordIds } })
        : [];
    const nameByDiscordId = new Map(
      players.map((p) => [p.discordId, p.minecraftUsername]),
    );

    return rows.flatMap((row) => {
      const project = projectById.get(row.curseforgeProjectId);
      if (!project) return [];
      const suggestion = row.workshopModId
        ? suggestionById.get(row.workshopModId)
        : undefined;
      const requiredBy =
        row.origin === "dependency"
          ? edges
              .filter(
                (edge) =>
                  edge.dependsOnProjectId === row.curseforgeProjectId &&
                  memberProjectIds.has(edge.curseforgeProjectId),
              )
              .map((edge) => ({
                curseforgeProjectId: edge.curseforgeProjectId,
                name:
                  projectById.get(edge.curseforgeProjectId)?.name ??
                  `#${edge.curseforgeProjectId}`,
              }))
          : [];
      return [
        {
          ...row,
          project: this.toProjectSummary(project),
          suggestedByName: suggestion
            ? (nameByDiscordId.get(suggestion.submittedBy) ?? null)
            : null,
          upvoteCount: suggestion ? (upvoteCounts[suggestion.id] ?? 0) : null,
          requiredBy,
          suggestionWorkshopId: suggestion?.workshopId ?? null,
          suggestionWorkshopName: suggestion
            ? (workshopNameById.get(suggestion.workshopId) ?? null)
            : null,
        },
      ];
    });
  }

  /**
   * Sync suggestions with what the manifest ships. rejected is excluded from
   * the shipped move so a sweep never undoes an explicit rejection; it
   * surfaces as a shipped_rejected attention item instead.
   */
  private async moveSuggestions(
    workshopModIds: number[],
    to: Extract<WorkshopModStatus, "next_update" | "in_pack">,
    releaseVersion: string | null,
  ): Promise<WorkshopMod[]> {
    if (workshopModIds.length === 0) return [];
    const mods = await Q.workshop.mod.findAll({
      id: { $in: workshopModIds },
      status: to === "in_pack" ? { $in: SHIP_CLAIMABLE_STATUSES } : "in_pack",
    });
    const moved: WorkshopMod[] = [];
    for (const mod of mods) {
      // Concurrent reconciles read the same rows, so the guarded update picks
      // one winner per move. Announcements and events are therefore
      // at-most-once: a crash between the claim and the write loses them,
      // since no later sweep retries
      const claimed = await Q.workshop.mod.updateAll(
        { status: to },
        { id: mod.id, status: mod.status },
      );
      if (claimed > 0) {
        moved.push({ ...mod, status: to });
        recordModEvent({
          eventType: to === "in_pack" ? "shipped" : "dropped",
          workshopId: mod.workshopId,
          workshopModId: mod.id,
          curseforgeProjectId: mod.curseforgeProjectId,
          fromStatus: mod.status,
          toStatus: to,
          releaseVersion,
        });
      }
    }
    return moved;
  }

  private async applyManifest(
    modpack: Modpack,
    workshops: Workshop[],
    manifest: ManifestMembership,
  ): Promise<void> {
    const now = new Date();
    const workshopIds = workshops.map((w) => w.id);
    const [rows, suggestions] = await Promise.all([
      Q.modpack.mod.findAll({ modpackId: modpack.id }),
      workshopIds.length > 0
        ? Q.workshop.mod.findAll({ workshopId: { $in: workshopIds } })
        : Promise.resolve([]),
    ]);

    const shippedModIds: number[] = [];
    const droppedModIds: number[] = [];

    for (const row of rows) {
      if (manifest.modIds.has(row.curseforgeProjectId)) {
        if (row.liveAt === null) {
          await Q.modpack.mod.updateAll(
            {
              liveAt: now,
              liveInVersion: manifest.version,
              droppedFromManifestAt: null,
              updatedAt: now,
            },
            { id: row.id },
          );
        } else if (row.droppedFromManifestAt !== null) {
          await Q.modpack.mod.updateAll(
            { droppedFromManifestAt: null, updatedAt: now },
            { id: row.id },
          );
        }
        if (row.workshopModId) shippedModIds.push(row.workshopModId);
        continue;
      }

      // A row only exists because the pack shipped the mod, so falling out of
      // the manifest is always a drop-out. Imports have no suggestion behind
      // them to fall back to, so they simply cease to be members
      if (row.origin === "import") {
        await Q.modpack.mod.deleteAll({ id: row.id });
        continue;
      }
      await Q.modpack.mod.updateAll(
        {
          liveAt: null,
          liveInVersion: null,
          droppedFromManifestAt: now,
          updatedAt: now,
        },
        { id: row.id },
      );
      if (row.workshopModId) droppedModIds.push(row.workshopModId);
    }

    const newProjectIds = [...manifest.modIds].filter(
      (id) => !rows.some((row) => row.curseforgeProjectId === id),
    );
    if (newProjectIds.length > 0) {
      shippedModIds.push(
        ...(await this.importManifestMods(
          modpack,
          workshopIds,
          suggestions,
          manifest,
          newProjectIds,
          now,
        )),
      );
    }

    announceStatusMoves([
      ...(await this.moveSuggestions(
        shippedModIds,
        "in_pack",
        manifest.version,
      )),
      ...(await this.moveSuggestions(
        droppedModIds,
        "next_update",
        manifest.version,
      )),
    ]);
  }

  /**
   * Create rows for manifest entries the pack does not know yet, classifying
   * each by where it came from: a suggestion it satisfies, a required
   * dependency of something else that shipped, or an outright import.
   */
  private async importManifestMods(
    modpack: Modpack,
    workshopIds: number[],
    suggestions: WorkshopMod[],
    manifest: ManifestMembership,
    projectIds: number[],
    now: Date,
  ): Promise<number[]> {
    const suggestionByProject = new Map<number, WorkshopMod>();
    for (const mod of suggestions) {
      const held = suggestionByProject.get(mod.curseforgeProjectId);
      if (!held || (held.status === "rejected" && mod.status !== "rejected")) {
        suggestionByProject.set(mod.curseforgeProjectId, mod);
      }
    }

    const unclaimed = projectIds.filter((id) => !suggestionByProject.has(id));
    const edges =
      workshopIds.length > 0 && unclaimed.length > 0
        ? await Q.workshop.project.dependency.findAll({
            workshopId: { $in: workshopIds },
            dependsOnProjectId: { $in: unclaimed },
            relationType: REQUIRED_DEPENDENCY,
          })
        : [];
    const pulledIn = new Set(
      edges
        .filter((edge) => manifest.modIds.has(edge.curseforgeProjectId))
        .map((edge) => edge.dependsOnProjectId),
    );

    await refreshProjects(projectIds);
    const cached = await Q.curseforge.project.findAll(
      { id: { $in: projectIds } },
      { select: ["id"] },
    );

    const shippedModIds: number[] = [];
    let created = 0;
    for (const project of cached) {
      const suggestion = suggestionByProject.get(project.id);
      try {
        await Q.modpack.mod.create({
          modpackId: modpack.id,
          curseforgeProjectId: project.id,
          origin: suggestion
            ? "suggestion"
            : pulledIn.has(project.id)
              ? "dependency"
              : "import",
          workshopModId: suggestion?.id ?? null,
          addedBy: null,
          fileId: suggestion?.fileId ?? null,
          fileName: suggestion?.fileName ?? null,
          fileReleaseType: suggestion?.fileReleaseType ?? null,
          liveAt: now,
          liveInVersion: manifest.version,
        });
        created++;
        if (suggestion) shippedModIds.push(suggestion.id);
      } catch (error) {
        if (!(error instanceof ConstraintViolationError)) throw error;
      }
    }
    if (created > 0) {
      logger.info(
        `Recorded ${created} published mods in modpack #${modpack.id}`,
      );
    }
    return shippedModIds;
  }

  private toProjectSummary(project: CurseforgeProject): ModpackProjectSummary {
    return {
      id: project.id,
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

  private async assertModpackProject(projectId: number): Promise<void> {
    let data: CurseForgeProjectData;
    try {
      data = await getMod(projectId);
    } catch {
      throw new BadRequestError(
        `Could not resolve CurseForge project #${projectId}`,
      );
    }
    if (data.classId !== CurseForgeClass.modpacks) {
      throw new BadRequestError(
        `"${data.name}" is not a modpack on CurseForge`,
      );
    }
  }

  private async assertServer(serverId: number): Promise<void> {
    const row = await Q.server.find({ id: serverId });
    if (!row) throw new BadRequestError(`Server #${serverId} not found`);
  }

  private mapProjectConflict(error: unknown): unknown {
    if (error instanceof ConstraintViolationError) {
      return new ConflictError(
        "Another modpack is already linked to that CurseForge project",
      );
    }
    return error;
  }
}

export const modpackService = new ModpackService();
