import { Q } from "@/db";
import {
  BadRequestError,
  NotFoundError,
  ConflictError,
} from "@/app/middleware/error-handler";
import type {
  StructurePack,
  StructurePackMod,
  StructurePackModCreate,
} from "@createrington/shared/db";
import type { StructurePackWithMods } from "@/db/queries/structure/pack";

export class StructurePackService {
  async createPack(name: string, description?: string): Promise<StructurePack> {
    const existing = await Q.structure.pack.find({ name });
    if (existing && !existing.deletedAt) {
      throw new ConflictError(
        `A structure pack named "${name}" already exists`,
      );
    }
    return Q.structure.pack.createAndReturn({ name, description });
  }

  async updatePack(
    id: number,
    data: { name?: string; description?: string },
  ): Promise<StructurePack> {
    const pack = await this.ensurePackExists(id);
    if (data.name && data.name !== pack.name) {
      const existing = await Q.structure.pack.find({ name: data.name });
      if (existing && !existing.deletedAt) {
        throw new ConflictError(
          `A structure pack named "${data.name}" already exists`,
        );
      }
    }
    return Q.structure.pack.updateAndReturn({ id }, data);
  }

  async deletePack(id: number): Promise<void> {
    const pack = await this.ensurePackExists(id);
    if (pack.isActive) {
      throw new BadRequestError("Cannot delete the currently active pack");
    }
    await Q.structure.pack.update(
      { id },
      {
        deletedAt: new Date(),
        enabled: false,
        name: `deleted-${pack.id}-${pack.name}`,
      },
    );
  }

  async toggleEnabled(id: number, enabled: boolean): Promise<StructurePack> {
    const pack = await this.ensurePackExists(id);
    if (pack.isActive && !enabled) {
      throw new BadRequestError("Cannot disable the currently active pack");
    }
    return Q.structure.pack.updateAndReturn({ id }, { enabled });
  }

  async getPack(id: number): Promise<StructurePackWithMods> {
    const pack = await Q.structure.pack.findOneWithMods(id);
    if (!pack) throw new NotFoundError(`Structure pack ${id} not found`);
    return pack;
  }

  async listPacks(): Promise<StructurePackWithMods[]> {
    return Q.structure.pack.findAllWithMods();
  }

  async addMod(
    packId: number,
    data: Omit<StructurePackModCreate, "packId">,
  ): Promise<StructurePackMod> {
    await this.ensurePackExists(packId);
    return Q.structure.pack.mod.createAndReturn({ ...data, packId });
  }

  async removeMod(packId: number, modId: number): Promise<void> {
    await this.ensurePackExists(packId);
    const mod = await Q.structure.pack.mod.find({ id: modId });
    if (!mod || mod.packId !== packId) {
      throw new NotFoundError(`Mod ${modId} not found in pack ${packId}`);
    }
    await Q.structure.pack.mod.delete({ id: modId });
  }

  async getActivePack(): Promise<StructurePackWithMods | null> {
    return Q.structure.pack.getActive();
  }

  async getEligiblePacks(excludeActive = true): Promise<StructurePack[]> {
    const active = await Q.structure.pack.getActive();
    return Q.structure.pack.getEligibleForRotation(
      excludeActive ? active?.id : undefined,
    );
  }

  private async ensurePackExists(id: number): Promise<StructurePack> {
    const pack = await Q.structure.pack.find({ id });
    if (!pack || pack.deletedAt) {
      throw new NotFoundError(`Structure pack ${id} not found`);
    }
    return pack;
  }
}

export const structurePackService = new StructurePackService();
