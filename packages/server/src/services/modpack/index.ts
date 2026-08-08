import { Q } from "@/db";
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
  Workshop,
  WorkshopMod,
} from "@createrington/shared/db";
import {
  CurseForgeClass,
  getMod,
  getModpackManifest,
  type CurseForgeProjectData,
  type ModpackManifest,
} from "@/services/curseforge";
import { refreshProjects } from "@/services/curseforge/ingest";
import {
  REQUIRED_DEPENDENCY,
  pruneOrphanedDependencies,
} from "@/services/workshop/dependencies";
import { announceReview } from "@/services/workshop/discord";

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
>;

export interface ModpackModListItem extends ModpackMod {
  project: ModpackProjectSummary;
  suggestedByName: string | null;
  addedByName: string | null;
  upvoteCount: number | null;
  requiredBy: Array<{ curseforgeProjectId: number; name: string }>;
}

export type ModpackListItem = Modpack & {
  modCount: number;
  liveCount: number;
};

export type ModpackAttentionItem =
  | {
      type: "dropped_from_pack";
      modpackModId: number;
      curseforgeProjectId: number;
      name: string;
      droppedAt: Date;
    }
  | {
      type: "shipped_unreviewed";
      workshopModId: number;
      curseforgeProjectId: number;
      name: string;
    }
  | {
      type: "shipped_rejected";
      workshopModId: number;
      curseforgeProjectId: number;
      name: string;
    }
  | {
      type: "rejected_dependency";
      workshopModId: number;
      curseforgeProjectId: number;
      name: string;
      requiredByName: string;
    }
  | {
      type: "unpromoted_dependency";
      workshopModId: number;
      curseforgeProjectId: number;
      name: string;
      requiredByName: string;
    };

/**
 * The durable pack artifact workshops feed into. Membership rows track how
 * each mod entered the pack; live state is derived from the published
 * CurseForge pack's manifest by reconcile, never set by hand.
 */
export class ModpackService {
  /** All modpacks with member counts, for the admin panel. */
  async listModpacks(): Promise<ModpackListItem[]> {
    const modpacks = await Q.modpack.findAll(
      {},
      { orderBy: "createdAt", orderDirection: "desc" },
    );
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
   * Remove a directly-added member (admin, dependency, or import origin).
   * Suggestion-origin members are removed by rejecting their suggestion.
   */
  async removePackMod(modpackModId: number): Promise<void> {
    const row = await Q.modpack.mod.find({ id: modpackModId });
    if (!row) throw new NotFoundError(`Modpack mod #${modpackModId} not found`);
    if (row.origin === "suggestion") {
      throw new BadRequestError(
        "This mod came from a suggestion, reject the suggestion instead",
      );
    }
    await Q.modpack.mod.deleteAll({ id: modpackModId });
    await pruneOrphanedDependencies(row.modpackId);
  }

  /**
   * Reconcile membership with reality: heal missing rows for approved
   * suggestions, then derive live state from the published pack's manifest,
   * import unknown shipped mods, and prune orphaned dependencies. Never
   * throws.
   */
  async reconcile(modpackId: number): Promise<void> {
    const modpack = await this.getModpack(modpackId);
    const workshops = await Q.workshop.findAll({ modpackId });

    await this.healSuggestionRows(modpack, workshops);

    if (modpack.curseforgeProjectId) {
      const manifest = await getModpackManifest(modpack.curseforgeProjectId);
      await this.applyManifest(modpack, workshops, manifest);
    }

    await pruneOrphanedDependencies(modpackId);
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
    if (manifest) {
      const { modIds } = manifest;
      shipped = suggestions.filter(
        (mod) =>
          modIds.has(mod.curseforgeProjectId) &&
          mod.status !== "next_update" &&
          mod.status !== "in_pack",
      );
    }

    const rejectedByProject = new Map(
      suggestions
        .filter((mod) => mod.status === "rejected")
        .map((mod) => [mod.curseforgeProjectId, mod]),
    );
    const midPipelineByProject = new Map(
      suggestions
        .filter(
          (mod) =>
            mod.status === "pending" ||
            mod.status === "approved" ||
            mod.status === "testing",
        )
        .map((mod) => [mod.curseforgeProjectId, mod]),
    );
    const packProjectIds = new Set(rows.map((row) => row.curseforgeProjectId));
    const edges =
      rejectedByProject.size > 0 || midPipelineByProject.size > 0
        ? await Q.workshop.project.dependency.findAll({
            workshopId: workshop.id,
            relationType: REQUIRED_DEPENDENCY,
          })
        : [];
    const rejectedDeps = new Map<
      number,
      { dep: WorkshopMod; requiredByProjectId: number }
    >();
    const unpromotedDeps = new Map<
      number,
      { dep: WorkshopMod; requiredByProjectId: number }
    >();
    for (const edge of edges) {
      if (packProjectIds.has(edge.dependsOnProjectId)) continue;
      if (!packProjectIds.has(edge.curseforgeProjectId)) continue;
      const rejected = rejectedByProject.get(edge.dependsOnProjectId);
      if (rejected && !rejectedDeps.has(edge.dependsOnProjectId)) {
        rejectedDeps.set(edge.dependsOnProjectId, {
          dep: rejected,
          requiredByProjectId: edge.curseforgeProjectId,
        });
      }
      const midPipeline = midPipelineByProject.get(edge.dependsOnProjectId);
      if (midPipeline && !unpromotedDeps.has(edge.dependsOnProjectId)) {
        unpromotedDeps.set(edge.dependsOnProjectId, {
          dep: midPipeline,
          requiredByProjectId: edge.curseforgeProjectId,
        });
      }
    }

    const projectIds = [
      ...new Set([
        ...dropped.map((row) => row.curseforgeProjectId),
        ...shipped.map((mod) => mod.curseforgeProjectId),
        ...[...rejectedDeps.entries(), ...unpromotedDeps.entries()].flatMap(
          ([depId, entry]) => [depId, entry.requiredByProjectId],
        ),
      ]),
    ];
    const projects =
      projectIds.length > 0
        ? await Q.curseforge.project.findAll({ id: { $in: projectIds } })
        : [];
    const nameById = new Map(projects.map((p) => [p.id, p.name]));
    const label = (id: number) => nameById.get(id) ?? `#${id}`;

    for (const row of dropped) {
      items.push({
        type: "dropped_from_pack",
        modpackModId: row.id,
        curseforgeProjectId: row.curseforgeProjectId,
        name: label(row.curseforgeProjectId),
        droppedAt: row.droppedFromManifestAt!,
      });
    }
    for (const mod of shipped) {
      items.push({
        type:
          mod.status === "rejected" ? "shipped_rejected" : "shipped_unreviewed",
        workshopModId: mod.id,
        curseforgeProjectId: mod.curseforgeProjectId,
        name: label(mod.curseforgeProjectId),
      });
    }
    for (const [projectId, entry] of rejectedDeps) {
      items.push({
        type: "rejected_dependency",
        workshopModId: entry.dep.id,
        curseforgeProjectId: projectId,
        name: label(projectId),
        requiredByName: label(entry.requiredByProjectId),
      });
    }
    for (const [projectId, entry] of unpromotedDeps) {
      items.push({
        type: "unpromoted_dependency",
        workshopModId: entry.dep.id,
        curseforgeProjectId: projectId,
        name: label(projectId),
        requiredByName: label(entry.requiredByProjectId),
      });
    }
    return items;
  }

  /** Decorate member rows; exposed for admin-add flows that already hold rows. */
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
      Q.workshop.findAll({ modpackId }, { select: ["id"] }),
      Q.modpack.mod.findAll({ modpackId }, { select: ["curseforgeProjectId"] }),
    ]);

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

    const discordIds = [
      ...new Set([
        ...suggestions.map((s) => s.submittedBy),
        ...rows
          .map((row) => row.addedBy)
          .filter((id): id is string => id !== null),
      ]),
    ];
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
          addedByName: row.addedBy
            ? (nameByDiscordId.get(row.addedBy) ?? null)
            : null,
          upvoteCount: suggestion ? (upvoteCounts[suggestion.id] ?? 0) : null,
          requiredBy,
        },
      ];
    });
  }

  private async healSuggestionRows(
    modpack: Modpack,
    workshops: Workshop[],
  ): Promise<void> {
    if (workshops.length === 0) return;
    const promoted = await Q.workshop.mod.findAll({
      workshopId: { $in: workshops.map((w) => w.id) },
      status: { $in: ["next_update", "in_pack"] },
    });
    if (promoted.length === 0) return;

    const rows = await Q.modpack.mod.findAll({ modpackId: modpack.id });
    const memberProjectIds = new Set(
      rows.map((row) => row.curseforgeProjectId),
    );
    for (const mod of promoted) {
      if (memberProjectIds.has(mod.curseforgeProjectId)) continue;
      try {
        await Q.modpack.mod.create({
          modpackId: modpack.id,
          curseforgeProjectId: mod.curseforgeProjectId,
          origin: "suggestion",
          workshopModId: mod.id,
          addedBy: null,
          fileId: mod.fileId,
          fileName: mod.fileName,
          fileReleaseType: mod.fileReleaseType,
        });
        logger.info(
          `Healed missing modpack row for approved suggestion #${mod.id}`,
        );
      } catch (error) {
        if (!(error instanceof ConstraintViolationError)) throw error;
      }
    }
  }

  private async markSuggestionShipped(
    workshopModId: number | null,
  ): Promise<void> {
    if (!workshopModId) return;
    const promoted = await Q.workshop.mod.updateAll(
      { status: "in_pack" },
      { id: workshopModId, status: "next_update" },
    );
    if (promoted === 0) return;
    const mod = await Q.workshop.mod.find({ id: workshopModId });
    if (mod) void announceReview(mod, "in_pack");
  }

  private async applyManifest(
    modpack: Modpack,
    workshops: Workshop[],
    manifest: ModpackManifest,
  ): Promise<void> {
    const now = new Date();
    const rows = await Q.modpack.mod.findAll({ modpackId: modpack.id });

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
        await this.markSuggestionShipped(row.workshopModId);
      } else if (row.liveAt !== null) {
        if (row.origin === "import") {
          await Q.modpack.mod.deleteAll({ id: row.id });
        } else {
          await Q.modpack.mod.updateAll(
            {
              liveAt: null,
              liveInVersion: null,
              droppedFromManifestAt: now,
              updatedAt: now,
            },
            { id: row.id },
          );
          if (row.workshopModId) {
            await Q.workshop.mod.updateAll(
              { status: "next_update" },
              { id: row.workshopModId, status: "in_pack" },
            );
          }
        }
      }
    }

    const knownProjectIds = new Set(rows.map((row) => row.curseforgeProjectId));
    const suggestions =
      workshops.length > 0
        ? await Q.workshop.mod.findAll({
            workshopId: { $in: workshops.map((w) => w.id) },
          })
        : [];
    const suggestedProjectIds = new Set(
      suggestions.map((mod) => mod.curseforgeProjectId),
    );
    const stowaways = [...manifest.modIds].filter(
      (id) => !knownProjectIds.has(id) && !suggestedProjectIds.has(id),
    );
    if (stowaways.length === 0) return;

    await refreshProjects(stowaways);
    const cached = await Q.curseforge.project.findAll(
      { id: { $in: stowaways } },
      { select: ["id"] },
    );
    let imported = 0;
    for (const project of cached) {
      try {
        await Q.modpack.mod.create({
          modpackId: modpack.id,
          curseforgeProjectId: project.id,
          origin: "import",
          workshopModId: null,
          addedBy: null,
          fileId: null,
          fileName: null,
          fileReleaseType: null,
          liveAt: now,
          liveInVersion: manifest.version,
        });
        imported++;
      } catch (error) {
        if (!(error instanceof ConstraintViolationError)) throw error;
      }
    }
    if (imported > 0) {
      logger.info(
        `Imported ${imported} shipped mods from the manifest into modpack #${modpack.id}`,
      );
    }
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
