import { Q } from "@/db";
import { BadRequestError } from "@/app/middleware/error-handler";
import type {
  Modpack,
  Workshop,
  WorkshopMod,
  WorkshopModStatus,
} from "@createrington/shared/db";
import { CurseForgeLoader } from "@/services/curseforge/client";
import {
  manifestDisabledModIds,
  type ModpackManifest,
} from "@/services/curseforge/modpack";
import { getModpackManifest } from "@/services/curseforge/modpack-manifest";
import { refreshProjects } from "@/services/curseforge/ingest";
import { REQUIRED_DEPENDENCY } from "@/services/workshop/dependencies";
import {
  announcePackDropOut,
  announceReview,
} from "@/services/workshop/discord";
import { recordModEvent } from "@/services/workshop/events";
import { modpackService } from "./modpack.service";
import { checkLauncherReleases, recordRelease } from "./release-record";

const SHIP_CLAIMABLE_STATUSES: WorkshopModStatus[] = [
  "pending",
  "approved",
  "testing",
  "next_update",
];

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

type ManifestMembership = Pick<
  ModpackManifest,
  "modIds" | "disabledModIds" | "version"
>;

export interface ModpackManifestSeedFile {
  projectId: number;
  required: boolean;
}

export interface ModpackManifestSeed {
  version: string | null;
  minecraftVersion: string | null;
  modLoader: string | null;
  files: ModpackManifestSeedFile[];
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

/**
 * Keeps membership in line with the published pack. Live state is derived
 * from the CurseForge manifest by reconcile (or from an uploaded manifest by
 * seedFromManifest before a project is linked), never set by hand; each
 * reconcile also records the release and moves workshop suggestions in and
 * out of in_pack to match.
 */
export class ModpackSyncService {
  /**
   * Bring membership in line with the published pack: every mod either
   * manifest lists gets a row classified by where it came from, suggestions
   * move in and out of in_pack to match, mods the latest publish dropped are
   * flagged, and CurseForge hints that match what shipped are promoted to
   * manifest values. Membership is never written anywhere else, so a row
   * means published. A pack known to ship a server pack is never applied
   * from a client-only read: that would drop every server-side member, so
   * the read is refused and nothing changes. force bypasses the manifest
   * cache (admin button, publish reports).
   */
  async reconcile(
    modpackId: number,
    options: { force?: boolean } = {},
  ): Promise<void> {
    const modpack = await modpackService.getModpack(modpackId);
    if (!modpack.curseforgeProjectId) return;
    checkLauncherReleases(modpack);

    const workshops = await Q.workshop.findAll({ modpackId });
    const manifest = await getModpackManifest(modpack.curseforgeProjectId, {
      force: options.force,
    });
    if (modpack.shipsServerPack && manifest.serverPackFileId === null) {
      throw new BadRequestError(
        `CurseForge served release ${manifest.version ?? manifest.fileId} (file ${manifest.fileId}) without a server pack while this modpack ships one, so nothing was changed. Wait for the sandbox to report the release or link the server pack on CurseForge, then check again.`,
      );
    }
    await this.applyManifest(modpack, workshops, manifest);
    await this.applyManifestEnvironments(manifest);
    await recordRelease(modpack, manifest);

    const now = new Date();
    if (manifest.serverPackFileId !== null && !modpack.shipsServerPack) {
      await Q.modpack.updateAll(
        { shipsServerPack: true, updatedAt: now },
        { id: modpack.id },
      );
    }
    await Q.modpack.publish.updateAll(
      { ingestedAt: now, lastError: null },
      { modpackId: modpack.id, clientFileId: manifest.fileId },
    );
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
    const modpack = await modpackService.getModpack(modpackId);
    if (modpack.curseforgeProjectId) {
      throw new BadRequestError(
        "This modpack follows a published CurseForge project, use Check Published Pack instead",
      );
    }

    const workshops = await Q.workshop.findAll({ modpackId });
    this.assertSeedTarget(workshops, seed);

    const modIds = new Set<number>();
    const duplicateProjectIds = new Set<number>();
    for (const file of seed.files) {
      if (modIds.has(file.projectId)) duplicateProjectIds.add(file.projectId);
      modIds.add(file.projectId);
    }
    await this.applyManifest(modpack, workshops, {
      modIds,
      disabledModIds: manifestDisabledModIds(seed.files),
      version: seed.version,
    });

    // Members dropped by an earlier seed keep their rows, so the count of
    // what this manifest covers is derived from the manifest side
    const rows = await Q.modpack.mod.findAll(
      { modpackId, curseforgeProjectId: { $in: [...modIds] } },
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

  /** Reconcile variant for sweeps and background kicks: logs failures, never throws. */
  async tryReconcile(modpackId: number): Promise<void> {
    try {
      await this.reconcile(modpackId);
    } catch (error) {
      logger.warn(`Modpack #${modpackId} reconcile failed:`, error);
    }
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
    publishedRequired: Map<number, boolean> = new Map(),
  ): Promise<WorkshopMod[]> {
    if (workshopModIds.length === 0) return [];
    const mods = await Q.workshop.mod.findAll({
      id: { $in: workshopModIds },
      status: to === "in_pack" ? { $in: SHIP_CLAIMABLE_STATUSES } : "in_pack",
    });
    const groups = new Map<
      string,
      { status: WorkshopModStatus; required: boolean; ids: number[] }
    >();
    for (const mod of mods) {
      const required = publishedRequired.get(mod.id) ?? mod.required;
      const key = `${mod.status}:${required}`;
      const group = groups.get(key) ?? {
        status: mod.status,
        required,
        ids: [],
      };
      group.ids.push(mod.id);
      groups.set(key, group);
    }

    // Concurrent reconciles read the same rows, so the status-guarded update
    // picks one winner per move. Announcements and events are therefore
    // at-most-once: a crash between the claim and the write loses them,
    // since no later sweep retries
    const moved: WorkshopMod[] = [];
    for (const group of groups.values()) {
      const claimed = await Q.workshop.mod.updateAllAndReturn(
        { status: to, required: group.required, fileChosen: false },
        { id: { $in: group.ids }, status: group.status },
      );
      for (const mod of claimed) {
        moved.push(mod);
        recordModEvent({
          eventType: to === "in_pack" ? "shipped" : "dropped",
          workshopId: mod.workshopId,
          workshopModId: mod.id,
          curseforgeProjectId: mod.curseforgeProjectId,
          fromStatus: group.status,
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
    const droppedRequired = new Map<number, boolean>();
    const goingLive = new Map<boolean, number[]>();
    const restored = new Map<boolean, number[]>();
    const removedImportIds: number[] = [];
    const droppedRowIds: number[] = [];
    const pushByRequired = (
      map: Map<boolean, number[]>,
      required: boolean,
      id: number,
    ) => {
      const ids = map.get(required) ?? [];
      ids.push(id);
      map.set(required, ids);
    };

    for (const row of rows) {
      if (manifest.modIds.has(row.curseforgeProjectId)) {
        const required = !manifest.disabledModIds.has(row.curseforgeProjectId);
        if (row.liveAt === null) {
          pushByRequired(goingLive, required, row.id);
        } else if (
          row.droppedFromManifestAt !== null ||
          row.required !== required
        ) {
          pushByRequired(restored, required, row.id);
        }
        if (row.workshopModId) shippedModIds.push(row.workshopModId);
        continue;
      }

      // A row only exists because the pack shipped the mod, so falling out of
      // the manifest is always a drop-out. Imports have no suggestion behind
      // them to fall back to, so they simply cease to be members
      if (row.origin === "import") {
        removedImportIds.push(row.id);
        continue;
      }
      if (row.droppedFromManifestAt === null) droppedRowIds.push(row.id);
      if (row.workshopModId) {
        droppedModIds.push(row.workshopModId);
        droppedRequired.set(row.workshopModId, row.required);
      }
    }

    for (const [required, ids] of goingLive) {
      await Q.modpack.mod.updateAll(
        {
          liveAt: now,
          liveInVersion: manifest.version,
          droppedFromManifestAt: null,
          required,
          updatedAt: now,
        },
        { id: { $in: ids } },
      );
    }
    for (const [required, ids] of restored) {
      await Q.modpack.mod.updateAll(
        { droppedFromManifestAt: null, required, updatedAt: now },
        { id: { $in: ids } },
      );
    }
    if (removedImportIds.length > 0) {
      await Q.modpack.mod.deleteAll({ id: { $in: removedImportIds } });
    }
    if (droppedRowIds.length > 0) {
      await Q.modpack.mod.updateAll(
        {
          liveAt: null,
          liveInVersion: null,
          droppedFromManifestAt: now,
          updatedAt: now,
        },
        { id: { $in: droppedRowIds } },
      );
    }

    const memberProjectIds = new Set(
      rows.map((row) => row.curseforgeProjectId),
    );
    const newProjectIds = [...manifest.modIds].filter(
      (id) => !memberProjectIds.has(id),
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
        droppedRequired,
      )),
    ]);
  }

  /**
   * Promote CurseForge hints the published pack agrees with to manifest.
   * Needs a server pack to say anything about sides; a hint the pack
   * disagrees with is left for the next refresh, and unspecified members
   * stay unspecified so they keep surfacing for review.
   */
  private async applyManifestEnvironments(
    manifest: ModpackManifest,
  ): Promise<void> {
    if (manifest.serverPackFileId === null || manifest.entries.length === 0) {
      return;
    }
    const sidesByProject = new Map(
      manifest.entries.map((entry) => [entry.projectId, entry.sides]),
    );
    const hinted = await Q.curseforge.project.findAll(
      {
        id: { $in: [...sidesByProject.keys()] },
        environmentSource: "cf_flag",
      },
      { select: ["id", "environment"] },
    );
    const confirmed = hinted
      .filter(
        (project) => project.environment === sidesByProject.get(project.id),
      )
      .map((project) => project.id);
    if (confirmed.length === 0) return;
    await Q.curseforge.project.updateAll(
      { environmentSource: "manifest" },
      { id: { $in: confirmed } },
    );
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

    const created = await Q.modpack.mod.createManyAndReturn(
      cached.map((project) => {
        const suggestion = suggestionByProject.get(project.id);
        return {
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
          required: !manifest.disabledModIds.has(project.id),
          liveAt: now,
          liveInVersion: manifest.version,
        };
      }),
      { onConflict: "ignore" },
    );
    if (created.length > 0) {
      logger.info(
        `Recorded ${created.length} published mods in modpack #${modpack.id}`,
      );
    }
    return created.flatMap((row) =>
      row.workshopModId !== null ? [row.workshopModId] : [],
    );
  }
}

export const modpackSyncService = new ModpackSyncService();
