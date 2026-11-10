import { Q } from "@/db";
import { NotFoundError } from "@/app/middleware/error-handler";
import type {
  CurseforgeProject,
  Modpack,
  ModpackMod,
  Workshop,
} from "@createrington/shared/db";
import { refreshProjects } from "@/services/curseforge/ingest";
import { REQUIRED_DEPENDENCY } from "@/services/workshop/dependencies";

export type ModpackProjectSummary = Pick<
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
  launcherPackSlug: string | null;
};

/**
 * The durable pack artifact workshops feed into, read side: modpacks and their
 * member rows decorated with project summaries, credit and live state.
 * Membership is written only by `modpackSyncService`.
 */
export class ModpackService {
  /** All modpacks with member counts, attached workshops and the slug of the launcher pack offering each, for the admin panel. */
  async listModpacks(): Promise<ModpackListItem[]> {
    const [modpacks, workshops, launcherPacks, counts] = await Promise.all([
      Q.modpack.findAll({}, { orderBy: "createdAt", orderDirection: "desc" }),
      Q.workshop.findAll(
        {},
        { select: ["id", "name", "slug", "status", "modpackId"] },
      ),
      Q.launcher.pack.findAll({}, { select: ["modpackId", "slug"] }),
      Q.modpack.mod.getCountsByModpack(),
    ]);
    const launcherPackSlugs = new Map(
      launcherPacks.map((pack) => [pack.modpackId, pack.slug]),
    );
    return modpacks.map((modpack) => ({
      ...modpack,
      modCount: counts.get(modpack.id)?.modCount ?? 0,
      liveCount: counts.get(modpack.id)?.liveCount ?? 0,
      workshops: workshops
        .filter((workshop) => workshop.modpackId === modpack.id)
        .map(({ id, name, slug, status }) => ({ id, name, slug, status })),
      launcherPackSlug: launcherPackSlugs.get(modpack.id) ?? null,
    }));
  }

  /** A modpack by id; throws when missing. */
  async getModpack(modpackId: number): Promise<Modpack> {
    const modpack = await Q.modpack.find({ id: modpackId });
    if (!modpack) throw new NotFoundError(`Modpack #${modpackId} not found`);
    return modpack;
  }

  /** Members of a modpack with project summaries, credit, and live state; liveOnly leaves out members the latest publish dropped. */
  async getPackMods(
    modpackId: number,
    options: { liveOnly?: boolean } = {},
  ): Promise<ModpackModListItem[]> {
    await this.getModpack(modpackId);
    const rows = await Q.modpack.mod.findAll(
      options.liveOnly
        ? { modpackId, droppedFromManifestAt: null }
        : { modpackId },
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
    const workshops = await Q.workshop.findAll(
      { modpackId },
      { select: ["id", "name"] },
    );
    const workshopNameById = new Map(workshops.map((w) => [w.id, w.name]));

    const [projects, suggestions, upvoteCounts, edges] = await Promise.all([
      Q.curseforge.project.findAll({ id: { $in: projectIds } }),
      suggestionIds.length > 0
        ? Q.workshop.mod.findAll({ id: { $in: suggestionIds } })
        : Promise.resolve([]),
      suggestionIds.length > 0
        ? Q.workshop.mod.upvote.countGroupedByMod(suggestionIds)
        : Promise.resolve({} as Record<number, number>),
      Q.workshop.project.dependency.getEdgesFromPackMembers(
        workshops.map((w) => w.id),
        projectIds,
        REQUIRED_DEPENDENCY,
        modpackId,
      ),
    ]);

    const projectById = new Map(projects.map((p) => [p.id, p]));
    const requirersByDependency = new Map<number, number[]>();
    for (const edge of edges) {
      const list = requirersByDependency.get(edge.dependsOnProjectId) ?? [];
      list.push(edge.curseforgeProjectId);
      requirersByDependency.set(edge.dependsOnProjectId, list);
    }
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
          ? (requirersByDependency.get(row.curseforgeProjectId) ?? []).map(
              (id) => ({
                curseforgeProjectId: id,
                name: projectById.get(id)?.name ?? `#${id}`,
              }),
            )
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

  private toProjectSummary(project: CurseforgeProject): ModpackProjectSummary {
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

export const modpackService = new ModpackService();
