import { Q, db } from "@/db";
import { BadRequestError, NotFoundError, ConflictError } from "@/errors";
import type {
  StructurePack,
  StructurePackMod,
  StructurePackModCreate,
} from "@createrington/shared/db";
import type { StructurePackWithMods } from "@/db/queries/structure/pack";
import type { StructurePackImportEntry } from "@createrington/shared/structure-pack";
import { getFilesDependencies } from "@/services/curseforge/files";
import { resolveDependencies } from "@/services/curseforge/mods";

export interface ModDependent {
  modName: string;
  relationType: number;
}

export interface RemovableDependency {
  modId: number;
  modName: string;
  safe: boolean;
  neededBy: string[];
}

export class StructurePackService {
  async createPack(
    name: string,
    description?: string,
    options: { enabled?: boolean } = {},
  ): Promise<StructurePack> {
    await this.assertNameAvailable(name);
    return Q.structure.pack.createAndReturn({
      name,
      description,
      ...(options.enabled !== undefined && { enabled: options.enabled }),
    });
  }

  async importPack(entry: StructurePackImportEntry): Promise<StructurePack> {
    await this.assertNameAvailable(entry.name);
    return db.inTransaction(async (tx) => {
      const pack = await tx.structure.pack.createAndReturn({
        name: entry.name,
        description: entry.description ?? undefined,
        enabled: false,
      });
      if (entry.mods.length > 0) {
        await tx.structure.pack.mod.createMany(
          entry.mods.map((mod) => ({
            packId: pack.id,
            curseforgeModId: mod.curseforgeModId,
            curseforgeFileId: mod.curseforgeFileId,
            fileName: mod.fileName,
            modName: mod.modName,
            modUrl: mod.modUrl ?? undefined,
            thumbnailUrl: mod.thumbnailUrl ?? undefined,
          })),
        );
      }
      return pack;
    });
  }

  async updatePack(
    id: number,
    data: { name?: string; description?: string },
  ): Promise<StructurePack> {
    const pack = await this.ensurePackExists(id);
    if (data.name && data.name !== pack.name) {
      await this.assertNameAvailable(data.name);
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
    const pack = await Q.structure.pack.findWithMods(id);
    if (!pack) throw new NotFoundError(`Structure pack ${id} not found`);
    return pack;
  }

  async listPacks(): Promise<StructurePackWithMods[]> {
    return Q.structure.pack.getAllWithMods();
  }

  async addMod(
    packId: number,
    data: Omit<StructurePackModCreate, "packId">,
  ): Promise<StructurePackMod> {
    await this.ensurePackExists(packId);
    return Q.structure.pack.mod.createAndReturn({ ...data, packId });
  }

  async addMods(
    packId: number,
    mods: Array<Omit<StructurePackModCreate, "packId">>,
  ): Promise<void> {
    await this.ensurePackExists(packId);
    await Q.structure.pack.mod.createMany(
      mods.map((data) => ({ ...data, packId })),
    );
  }

  async removeMod(packId: number, modId: number): Promise<void> {
    await this.ensurePackExists(packId);
    const mod = await Q.structure.pack.mod.find({ id: modId });
    if (!mod || mod.packId !== packId) {
      throw new NotFoundError(`Mod ${modId} not found in pack ${packId}`);
    }
    await Q.structure.pack.mod.delete({ id: modId });
  }

  /** For removing a mod from a pack: the pack mods that depend on it, and which of its in-pack dependencies no other mod needs. */
  async checkDeleteDependencies(
    packId: number,
    modId: number,
  ): Promise<{ deps: RemovableDependency[]; dependents: ModDependent[] }> {
    const pack = await this.getPack(packId);
    const target = pack.mods.find((m) => m.id === modId);
    if (!target) return { deps: [], dependents: [] };

    const modNames = new Map<number, string>();
    for (const mod of pack.mods) {
      if (!modNames.has(mod.curseforgeModId)) {
        modNames.set(mod.curseforgeModId, mod.modName);
      }
    }

    const files = await getFilesDependencies(
      pack.mods.map((m) => m.curseforgeFileId),
    );
    const otherFiles = files.filter(
      (file) => file.modId !== target.curseforgeModId,
    );

    const dependents = otherFiles.flatMap((file) => {
      const modName = modNames.get(file.modId);
      if (modName === undefined) return [];
      return file.dependencies
        .filter((dep) => dep.modId === target.curseforgeModId)
        .map((dep) => ({ modName, relationType: dep.relationType }));
    });

    const targetFile = files.find((f) => f.fileId === target.curseforgeFileId);
    const inPackDepIds = [
      ...new Set((targetFile?.dependencies ?? []).map((d) => d.modId)),
    ].filter((id) => modNames.has(id));
    if (inPackDepIds.length === 0) return { deps: [], dependents };

    const resolved = await resolveDependencies(
      inPackDepIds,
      new Set(modNames.keys()),
    );

    const deps = resolved.map((dep) => {
      const neededBy = [
        ...new Set(
          otherFiles
            .filter((file) =>
              file.dependencies.some((d) => d.modId === dep.modId),
            )
            .map((file) => file.modId),
        ),
      ];
      return {
        modId: dep.modId,
        modName: dep.modName,
        safe: neededBy.length === 0,
        neededBy: neededBy.map((id) => modNames.get(id) ?? "").filter(Boolean),
      };
    });

    return { deps, dependents };
  }

  async getActivePack(): Promise<StructurePackWithMods | null> {
    return Q.structure.pack.findActive();
  }

  private async assertNameAvailable(name: string): Promise<void> {
    const existing = await Q.structure.pack.find({ name });
    if (existing && !existing.deletedAt) {
      throw new ConflictError(
        `A structure pack named "${name}" already exists`,
      );
    }
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
