import { db, Q } from "@/db";
import { BadRequestError, ConflictError } from "@/app/middleware/error-handler";
import { UniqueViolationError } from "@/db/utils/errors";
import type { Workshop } from "@createrington/shared/db";
import { WORKSHOP_STATUS_TRANSITIONS } from "@createrington/shared/workshop";
import { CurseForgeClass } from "@/services/curseforge/client";
import { getMod, type CurseForgeProjectData } from "@/services/curseforge/mods";
import { modpackService } from "@/services/modpack/modpack.service";
import { assertForumChannel } from "./discord";
import { workshopService } from "./workshop.service";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100)
    .replace(/-+$/, "");
}

/**
 * Admin edits of workshop rows: create (into an existing modpack or a new
 * one), update including lifecycle status moves, and delete once archived.
 */
export class WorkshopAdminService {
  /** Create a workshop campaign feeding an existing modpack. */
  async createWorkshop(
    input: {
      name: string;
      slug?: string;
      description?: string;
      gameVersion: string;
      modLoaderType: number;
      classId?: number;
      baseModpackProjectId?: number | null;
      modpackId?: number;
      newModpackName?: string;
      maxModsPerUser?: number;
      maxUpvotesPerUser?: number;
      discordForumChannelId?: string | null;
    },
    adminId: string,
  ): Promise<Workshop> {
    const { modpackId, newModpackName } = input;
    if (modpackId !== undefined && newModpackName !== undefined) {
      throw new BadRequestError(
        "Provide either an existing modpack or a new modpack name, not both",
      );
    }

    const slug = input.slug ?? slugify(input.name);
    if (!slug)
      throw new BadRequestError("Workshop name produces an empty slug");

    const existing = await Q.workshop.find({ slug });
    if (existing) {
      throw new ConflictError(`A workshop with slug "${slug}" already exists`);
    }

    if (modpackId !== undefined) {
      await modpackService.getModpack(modpackId);
    }
    if (input.baseModpackProjectId) {
      await this.assertBaseModpack(input.baseModpackProjectId);
    }
    if (input.discordForumChannelId) {
      await assertForumChannel(input.discordForumChannelId);
    }

    const row = (targetModpackId: number) => ({
      name: input.name,
      slug,
      description: input.description ?? null,
      gameVersion: input.gameVersion,
      modLoaderType: input.modLoaderType,
      classId: input.classId ?? CurseForgeClass.mods,
      baseModpackProjectId: input.baseModpackProjectId ?? null,
      modpackId: targetModpackId,
      maxModsPerUser: input.maxModsPerUser ?? 5,
      maxUpvotesPerUser: input.maxUpvotesPerUser ?? 5,
      discordForumChannelId: input.discordForumChannelId ?? null,
      createdBy: adminId,
    });

    try {
      if (newModpackName !== undefined) {
        return await db.inTransaction(async (tx) => {
          const modpack = await tx.modpack.createAndReturn({
            name: newModpackName,
            description: null,
            curseforgeProjectId: null,
            serverId: null,
            createdBy: adminId,
          });
          return tx.workshop.createAndReturn(row(modpack.id));
        });
      }
      if (modpackId !== undefined) {
        return await Q.workshop.createAndReturn(row(modpackId));
      }
      throw new BadRequestError(
        "Provide either an existing modpack or a name for a new one",
      );
    } catch (error) {
      if (error instanceof UniqueViolationError) {
        throw new ConflictError(
          `A workshop with slug "${slug}" already exists`,
        );
      }
      throw error;
    }
  }

  /**
   * Update workshop fields, including lifecycle status. Renaming the slug
   * throws ConflictError when another workshop already uses it.
   */
  async updateWorkshop(
    workshopId: number,
    patch: Partial<{
      name: string;
      slug: string;
      description: string | null;
      status: Workshop["status"];
      classId: number;
      baseModpackProjectId: number | null;
      modpackId: number;
      maxModsPerUser: number;
      maxUpvotesPerUser: number;
      discordForumChannelId: string | null;
    }>,
  ): Promise<Workshop> {
    const workshop = await workshopService.getWorkshop(workshopId);

    if (
      patch.status &&
      patch.status !== workshop.status &&
      !WORKSHOP_STATUS_TRANSITIONS[workshop.status].includes(patch.status)
    ) {
      throw new BadRequestError(
        `A ${workshop.status} workshop cannot move to ${patch.status}`,
      );
    }

    const targetChanged =
      (patch.classId !== undefined && patch.classId !== workshop.classId) ||
      (patch.baseModpackProjectId !== undefined &&
        patch.baseModpackProjectId !== workshop.baseModpackProjectId) ||
      (patch.modpackId !== undefined && patch.modpackId !== workshop.modpackId);
    if (targetChanged && (await Q.workshop.mod.count({ workshopId })) > 0) {
      throw new BadRequestError(
        "Cannot change the project type, base modpack, or modpack of a workshop that already has mods",
      );
    }

    if (
      patch.modpackId !== undefined &&
      patch.modpackId !== workshop.modpackId
    ) {
      await modpackService.getModpack(patch.modpackId);
    }
    if (
      patch.baseModpackProjectId != null &&
      patch.baseModpackProjectId !== workshop.baseModpackProjectId
    ) {
      await this.assertBaseModpack(patch.baseModpackProjectId);
    }

    if (
      patch.discordForumChannelId &&
      patch.discordForumChannelId !== workshop.discordForumChannelId
    ) {
      await assertForumChannel(patch.discordForumChannelId);
    }

    if (patch.slug !== undefined && patch.slug !== workshop.slug) {
      const existing = await Q.workshop.find({ slug: patch.slug });
      if (existing) {
        throw new ConflictError(
          `A workshop with slug "${patch.slug}" already exists`,
        );
      }
    }

    try {
      return await Q.workshop.updateAndReturn({ id: workshopId }, patch);
    } catch (error) {
      if (error instanceof UniqueViolationError && patch.slug !== undefined) {
        throw new ConflictError(
          `A workshop with slug "${patch.slug}" already exists`,
        );
      }
      throw error;
    }
  }

  /**
   * Delete an archived workshop with its suggestions, votes, polls, and event
   * history. Modpack member rows survive with their suggestion link detached,
   * so per-mod credit in the pack is lost. Discord threads are left alone.
   */
  async deleteWorkshop(workshopId: number): Promise<Workshop> {
    const workshop = await workshopService.getWorkshop(workshopId);
    if (workshop.status !== "archived") {
      throw new BadRequestError("Only archived workshops can be deleted");
    }
    await Q.workshop.delete({ id: workshop.id });
    return workshop;
  }

  private async assertBaseModpack(projectId: number): Promise<void> {
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
}

export const workshopAdminService = new WorkshopAdminService();
