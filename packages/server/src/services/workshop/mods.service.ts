import { Q } from "@/db";
import { NotFoundError } from "@/app/middleware/error-handler";
import type {
  CurseforgeProject,
  Workshop,
  WorkshopMod,
  WorkshopModStatus,
  WorkshopProjectDependency,
} from "@createrington/shared/db";
import { discordThreadUrl } from "./discord";
import {
  loadDependencyContext,
  REQUIRED_DEPENDENCY,
  type DependencyCoverage,
} from "./dependencies";
import { USER_VISIBLE_MOD_STATUSES, workshopService } from "./workshop.service";

export type WorkshopProjectSummary = Pick<
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

export interface WorkshopModDependencyInfo {
  curseforgeProjectId: number;
  relationType: number;
  name: string | null;
  slug: string | null;
  thumbnailUrl: string | null;
  coverage: DependencyCoverage;
  requiredByCount: number;
}

export interface WorkshopModListItem extends WorkshopMod {
  project: WorkshopProjectSummary;
  upvoteCount: number;
  submitterName: string | null;
  submitterUuid: string | null;
  discordThreadUrl: string | null;
  dependencies: WorkshopModDependencyInfo[];
  liveInVersion: string | null;
}

export interface WorkshopDependencyListItem {
  curseforgeProjectId: number;
  classId: number | null;
  name: string | null;
  slug: string | null;
  thumbnailUrl: string | null;
  coverage: DependencyCoverage;
  requiredBy: Array<{ curseforgeProjectId: number; name: string }>;
  optionalByCount: number;
  shippingDemand: number;
}

export type WorkshopSuggestionHistoryItem = WorkshopModListItem & {
  workshopName: string;
  workshopSlug: string;
};

/**
 * Suggestions as the workshop pages show them: rows decorated with project
 * summaries, upvotes, submitter, Discord thread, dependency coverage and the
 * version the pack shipped them in, plus the workshop-wide dependency list.
 */
export class WorkshopModService {
  /** Suggestions in a workshop with project summaries and upvote counts. */
  async getWorkshopMods(
    workshopId: number,
    options: { includeHidden?: boolean; statuses?: WorkshopModStatus[] } = {},
  ): Promise<WorkshopModListItem[]> {
    const workshop = await workshopService.getWorkshop(workshopId);
    const statuses =
      options.statuses ??
      (options.includeHidden ? null : USER_VISIBLE_MOD_STATUSES);
    const mods = await Q.workshop.mod.findAll(
      {
        workshopId,
        ...(statuses ? { status: { $in: statuses } } : {}),
      },
      { orderBy: "createdAt", orderDirection: "desc" },
    );
    return this.decorateMods(workshop, mods);
  }

  /** One mod in the same shape as the workshop listing. */
  async getWorkshopModListItem(
    workshopModId: number,
  ): Promise<WorkshopModListItem> {
    const mod = await Q.workshop.mod.find({ id: workshopModId });
    if (!mod) {
      throw new NotFoundError(`Mod #${workshopModId} not found`);
    }
    const workshop = await workshopService.getWorkshop(mod.workshopId);
    const [item] = await this.decorateMods(workshop, [mod]);
    if (!item) {
      throw new NotFoundError(
        `CurseForge project #${mod.curseforgeProjectId} is not cached`,
      );
    }
    return item;
  }

  /** A single mod with the full cached project detail (description included). */
  async getModDetail(
    workshopModId: number,
    options: { includeHidden?: boolean } = {},
  ): Promise<{
    mod: WorkshopMod & {
      submitterName: string | null;
      submitterUuid: string | null;
      reviewerName: string | null;
      discordThreadUrl: string | null;
      dependencies: WorkshopModDependencyInfo[];
      liveInVersion: string | null;
    };
    project: CurseforgeProject;
    upvoteCount: number;
  }> {
    const mod = await Q.workshop.mod.find({ id: workshopModId });
    if (!mod) {
      throw new NotFoundError(`Mod #${workshopModId} not found`);
    }
    const workshop = await workshopService.getWorkshop(mod.workshopId);
    if (!options.includeHidden) {
      workshopService.assertUserVisible(workshop);
    }
    const [project, upvoteCount, submitter, reviewer, depRows, packRow] =
      await Promise.all([
        Q.curseforge.project.get({ id: mod.curseforgeProjectId }),
        Q.workshop.mod.upvote.count({ workshopModId }),
        Q.player.find({ discordId: mod.submittedBy }),
        mod.reviewedBy ? Q.player.find({ discordId: mod.reviewedBy }) : null,
        Q.workshop.project.dependency.findAll({
          workshopId: mod.workshopId,
          curseforgeProjectId: mod.curseforgeProjectId,
        }),
        Q.modpack.mod.find({
          modpackId: workshop.modpackId,
          curseforgeProjectId: mod.curseforgeProjectId,
        }),
      ]);
    const depsByProject = await this.buildDependencyInfo(workshop, depRows);
    return {
      mod: {
        ...mod,
        submitterName: submitter?.minecraftUsername ?? null,
        submitterUuid: submitter?.minecraftUuid ?? null,
        reviewerName: reviewer?.minecraftUsername ?? null,
        discordThreadUrl: mod.discordThreadId
          ? discordThreadUrl(mod.discordThreadId)
          : null,
        dependencies: depsByProject.get(mod.curseforgeProjectId) ?? [],
        liveInVersion: packRow?.liveInVersion ?? null,
      },
      project,
      upvoteCount,
    };
  }

  /** The caller's own suggestions in a workshop, all statuses. */
  async getMySuggestions(
    workshopId: number,
    discordId: string,
  ): Promise<WorkshopModListItem[]> {
    const workshop = await workshopService.getWorkshop(workshopId);
    workshopService.assertUserVisible(workshop);
    const mods = await Q.workshop.mod.findAll(
      { workshopId, submittedBy: discordId },
      { orderBy: "createdAt", orderDirection: "asc" },
    );
    return this.decorateMods(workshop, mods);
  }

  /** The caller's suggestions across all user-visible workshops, newest first. */
  async getMySuggestionHistory(
    discordId: string,
  ): Promise<WorkshopSuggestionHistoryItem[]> {
    const workshops = await Q.workshop.findAll({
      status: { $in: ["open", "closed"] },
    });
    if (workshops.length === 0) return [];
    const mods = await Q.workshop.mod.findAll(
      {
        submittedBy: discordId,
        workshopId: { $in: workshops.map((w) => w.id) },
      },
      {
        orderBy: [
          { field: "createdAt", direction: "desc" },
          { field: "id", direction: "desc" },
        ],
      },
    );
    const byWorkshop = new Map<number, WorkshopMod[]>();
    for (const mod of mods) {
      const list = byWorkshop.get(mod.workshopId) ?? [];
      list.push(mod);
      byWorkshop.set(mod.workshopId, list);
    }
    const decorated = await Promise.all(
      workshops.flatMap((workshop) => {
        const own = byWorkshop.get(workshop.id);
        if (!own) return [];
        return [
          this.decorateMods(workshop, own).then((items) =>
            items.map((item) => ({
              ...item,
              workshopName: workshop.name,
              workshopSlug: workshop.slug,
            })),
          ),
        ];
      }),
    );
    const itemById = new Map(
      decorated.flat().map((item) => [item.id, item] as const),
    );
    return mods.flatMap((mod) => itemById.get(mod.id) ?? []);
  }

  /** Rejected mods in a user-visible workshop, for the public ruled-out list. */
  async getRejectedMods(workshopId: number): Promise<WorkshopModListItem[]> {
    const workshop = await workshopService.getWorkshop(workshopId);
    workshopService.assertUserVisible(workshop);
    const mods = await Q.workshop.mod.findAll(
      { workshopId, status: "rejected" },
      { orderBy: "reviewedAt", orderDirection: "desc" },
    );
    return this.decorateMods(workshop, mods);
  }

  /** Workshop-wide dependency coverage, one row per depended-on project. */
  async getWorkshopDependencies(
    workshopId: number,
  ): Promise<WorkshopDependencyListItem[]> {
    const workshop = await workshopService.getWorkshop(workshopId);
    const groups = await Q.workshop.project.dependency.getGroupsByDependency(
      workshopId,
      REQUIRED_DEPENDENCY,
    );
    if (groups.length === 0) return [];

    const dependencyIds = groups.map((group) => group.dependsOnProjectId);
    const projectIds = [
      ...new Set([
        ...dependencyIds,
        ...groups.flatMap((group) => group.requiredByProjectIds),
      ]),
    ];
    const [projects, context] = await Promise.all([
      Q.curseforge.project.findAll({ id: { $in: projectIds } }),
      loadDependencyContext(workshop, dependencyIds),
    ]);
    const projectById = new Map(
      projects.map((project) => [project.id, project]),
    );

    return groups.map((group) => {
      const project = projectById.get(group.dependsOnProjectId);
      return {
        curseforgeProjectId: group.dependsOnProjectId,
        classId: project?.classId ?? null,
        name: project?.name ?? null,
        slug: project?.slug ?? null,
        thumbnailUrl: project?.thumbnailUrl ?? null,
        coverage:
          context.coverage.get(group.dependsOnProjectId) ??
          ("missing" as const),
        requiredBy: group.requiredByProjectIds.map((id) => ({
          curseforgeProjectId: id,
          name: projectById.get(id)?.name ?? `#${id}`,
        })),
        optionalByCount: group.optionalByCount,
        shippingDemand: context.demand.get(group.dependsOnProjectId) ?? 0,
      };
    });
  }

  /** List items for suggestion rows; a row whose project is not cached is left out. */
  async decorateMods(
    workshop: Workshop,
    mods: WorkshopMod[],
  ): Promise<WorkshopModListItem[]> {
    if (mods.length === 0) return [];

    const projectIds = [...new Set(mods.map((m) => m.curseforgeProjectId))];
    const submitterIds = [...new Set(mods.map((m) => m.submittedBy))];
    const [projects, upvoteCounts, submitters, depRows, packRows] =
      await Promise.all([
        Q.curseforge.project.findAll({ id: { $in: projectIds } }),
        Q.workshop.mod.upvote.countGroupedByMod(mods.map((m) => m.id)),
        Q.player.findAll({ discordId: { $in: submitterIds } }),
        Q.workshop.project.dependency.findAll({
          workshopId: workshop.id,
          curseforgeProjectId: { $in: projectIds },
        }),
        Q.modpack.mod.findAll({
          modpackId: workshop.modpackId,
          curseforgeProjectId: { $in: projectIds },
        }),
      ]);
    const byId = new Map(projects.map((p) => [p.id, p]));
    const submitterByDiscordId = new Map(
      submitters.map((p) => [p.discordId, p]),
    );
    const packByProjectId = new Map(
      packRows.map((row) => [row.curseforgeProjectId, row]),
    );
    const depsByProject = await this.buildDependencyInfo(workshop, depRows);

    return mods.flatMap((mod) => {
      const project = byId.get(mod.curseforgeProjectId);
      if (!project) return [];
      const packRow = packByProjectId.get(mod.curseforgeProjectId);
      const submitter = submitterByDiscordId.get(mod.submittedBy);
      return [
        {
          ...mod,
          project: this.toProjectSummary(project),
          upvoteCount: upvoteCounts[mod.id] ?? 0,
          submitterName: submitter?.minecraftUsername ?? null,
          submitterUuid: submitter?.minecraftUuid ?? null,
          discordThreadUrl: mod.discordThreadId
            ? discordThreadUrl(mod.discordThreadId)
            : null,
          dependencies: depsByProject.get(mod.curseforgeProjectId) ?? [],
          liveInVersion: packRow?.liveInVersion ?? null,
        },
      ];
    });
  }

  private async buildDependencyInfo(
    workshop: Workshop,
    depRows: WorkshopProjectDependency[],
  ): Promise<Map<number, WorkshopModDependencyInfo[]>> {
    const byProject = new Map<number, WorkshopModDependencyInfo[]>();
    if (depRows.length === 0) return byProject;

    const depProjectIds = [
      ...new Set(depRows.map((d) => d.dependsOnProjectId)),
    ];
    const [depProjects, context] = await Promise.all([
      Q.curseforge.project.findAll({ id: { $in: depProjectIds } }),
      loadDependencyContext(workshop, depProjectIds),
    ]);
    const projectById = new Map(depProjects.map((p) => [p.id, p]));

    for (const dep of depRows) {
      const project = projectById.get(dep.dependsOnProjectId);
      const info: WorkshopModDependencyInfo = {
        curseforgeProjectId: dep.dependsOnProjectId,
        relationType: dep.relationType,
        name: project?.name ?? null,
        slug: project?.slug ?? null,
        thumbnailUrl: project?.thumbnailUrl ?? null,
        coverage: context.coverage.get(dep.dependsOnProjectId) ?? "missing",
        requiredByCount: context.demand.get(dep.dependsOnProjectId) ?? 0,
      };
      const list = byProject.get(dep.curseforgeProjectId) ?? [];
      list.push(info);
      byProject.set(dep.curseforgeProjectId, list);
    }
    return byProject;
  }

  private toProjectSummary(project: CurseforgeProject): WorkshopProjectSummary {
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
}

export const workshopModService = new WorkshopModService();
