import { Q } from "@/db";
import { BadRequestError, ConflictError } from "@/app/middleware/error-handler";
import {
  ForeignKeyViolationError,
  UniqueViolationError,
} from "@/db/utils/errors";
import type { Modpack } from "@createrington/shared/db";
import { CurseForgeClass } from "@/services/curseforge/client";
import { getMod, type CurseForgeProjectData } from "@/services/curseforge/mods";
import { modpackService } from "./modpack.service";
import { modpackSyncService } from "./sync.service";

/**
 * Admin edits of modpack rows: create, update and delete, with the CurseForge
 * project, server and launcher checks that guard them. Linking a CurseForge
 * project for the first time kicks off a background reconcile.
 */
export class ModpackAdminService {
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
   * first time kicks off an immediate reconcile. Refused when the project of
   * a modpack the launcher offers would change.
   */
  async updateModpack(
    modpackId: number,
    patch: Partial<{
      name: string;
      description: string | null;
      curseforgeProjectId: number | null;
      shipsServerPack: boolean;
      serverId: number | null;
      titleImageUrl: string | null;
      iconUrl: string | null;
    }>,
  ): Promise<Modpack> {
    const modpack = await modpackService.getModpack(modpackId);
    if (
      patch.curseforgeProjectId !== undefined &&
      patch.curseforgeProjectId !== modpack.curseforgeProjectId
    ) {
      await this.assertNotOfferedByLauncher(
        modpack,
        "its CurseForge project cannot be changed",
      );
      if (patch.curseforgeProjectId) {
        await this.assertModpackProject(patch.curseforgeProjectId);
      }
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
      void modpackSyncService.tryReconcile(modpackId);
    }
    return updated;
  }

  /**
   * Delete a modpack together with its members and release history. Refused
   * while any workshop, archived ones included, still points at it, and while
   * the launcher offers it. Returns counts of what was destroyed for the audit
   * trail.
   */
  async deleteModpack(
    modpackId: number,
  ): Promise<{ modpack: Modpack; modCount: number; releaseCount: number }> {
    const modpack = await modpackService.getModpack(modpackId);
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
    await this.assertNotOfferedByLauncher(modpack, "it cannot be deleted");
    const [modCount, releaseCount] = await Promise.all([
      Q.modpack.mod.count({ modpackId }),
      Q.modpack.release.count({ modpackId }),
    ]);
    try {
      await Q.modpack.delete({ id: modpack.id });
    } catch (error) {
      if (error instanceof ForeignKeyViolationError) {
        throw new ConflictError(
          "A workshop or launcher pack was attached to this modpack while it was being deleted",
        );
      }
      throw error;
    }
    return { modpack, modCount, releaseCount };
  }

  private async assertNotOfferedByLauncher(
    modpack: Modpack,
    consequence: string,
  ): Promise<void> {
    const pack = await Q.launcher.pack.find({ modpackId: modpack.id });
    if (pack) {
      throw new ConflictError(
        `The launcher offers this modpack as "${pack.slug}", so ${consequence}. Remove that launcher pack on the owner Launcher packs page first.`,
      );
    }
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
    if (error instanceof UniqueViolationError) {
      return new ConflictError(
        "Another modpack is already linked to that CurseForge project",
      );
    }
    return error;
  }
}

export const modpackAdminService = new ModpackAdminService();
