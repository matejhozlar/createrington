import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { structurePackService } from "@/services/structure-pack";
import { getService, Services } from "@/services";
import {
  searchMods,
  getModFiles,
  resolveDependencies,
  getFilesDependencies,
} from "@/services/curseforge";
import { paginationInput, buildPagination } from "@/trpc/utils";
import type { StructurePackRotationService } from "@/services/structure-pack/rotation";

/** Resolves the structure pack rotation service from the DI container */
async function getRotationService(): Promise<StructurePackRotationService> {
  return getService(Services.STRUCTURE_PACK_ROTATION);
}

/**
 * Admin Structure Packs Router
 *
 * Manages structure packs and their weekly rotation schedule:
 * - CRUD for structure packs (create, read, update, soft-delete)
 * - Mod management: add/remove CurseForge mods linked to a pack
 * - CurseForge integration: search mods and browse available files
 * - Dependency resolution: inspect and validate inter-mod dependencies
 * - Rotation control: trigger manual rotations and paginate rotation history
 * - Rotation config: read and update the rotation schedule settings
 */
export const adminStructurePacksRouter = router({
  list: adminProcedure
    .meta({ description: "List all structure packs with their mods" })
    .query(async () => {
      return structurePackService.listPacks();
    }),

  get: adminProcedure
    .meta({ description: "Get a single structure pack with its mods" })
    .input(z.object({ id: z.coerce.number().int().positive() }))
    .query(async ({ input }) => {
      return structurePackService.getPack(input.id);
    }),

  create: adminProcedure
    .meta({ description: "Create a new structure pack" })
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      return structurePackService.createPack(input.name, input.description);
    }),

  update: adminProcedure
    .meta({ description: "Update a structure pack's name or description" })
    .input(
      z.object({
        id: z.coerce.number().int().positive(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      return structurePackService.updatePack(id, data);
    }),

  delete: adminProcedure
    .meta({ description: "Soft-delete a structure pack" })
    .input(z.object({ id: z.coerce.number().int().positive() }))
    .mutation(async ({ input }) => {
      await structurePackService.deletePack(input.id);
      return { deleted: true };
    }),

  toggleEnabled: adminProcedure
    .meta({ description: "Enable or disable a pack for rotation" })
    .input(
      z.object({
        id: z.coerce.number().int().positive(),
        enabled: z.boolean(),
      }),
    )
    .mutation(async ({ input }) => {
      return structurePackService.toggleEnabled(input.id, input.enabled);
    }),

  // Mod management
  addMod: adminProcedure
    .meta({ description: "Add a CurseForge mod to a structure pack" })
    .input(
      z.object({
        packId: z.coerce.number().int().positive(),
        curseforgeModId: z.number().int().positive(),
        curseforgeFileId: z.number().int().positive(),
        fileName: z.string().min(1),
        modName: z.string().min(1),
        modUrl: z.string().url().optional(),
        thumbnailUrl: z.string().url().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      // Validate the download URL is resolvable before persisting
      const rotationService = await getRotationService();
      await rotationService.validateModDownloadable(
        input.curseforgeModId,
        input.curseforgeFileId,
      );
      const { packId, ...modData } = input;
      return structurePackService.addMod(packId, modData);
    }),

  removeMod: adminProcedure
    .meta({ description: "Remove a mod from a structure pack" })
    .input(
      z.object({
        packId: z.coerce.number().int().positive(),
        modId: z.coerce.number().int().positive(),
      }),
    )
    .mutation(async ({ input }) => {
      await structurePackService.removeMod(input.packId, input.modId);
      return { removed: true };
    }),

  // CurseForge search
  searchMods: adminProcedure
    .meta({ description: "Search CurseForge for mods" })
    .input(z.object({ query: z.string().min(1).max(100) }))
    .query(async ({ input }) => {
      return searchMods(input.query);
    }),

  getModFiles: adminProcedure
    .meta({ description: "Get available files for a CurseForge mod" })
    .input(z.object({ modId: z.number().int().positive() }))
    .query(async ({ input }) => {
      return getModFiles(input.modId);
    }),

  // Dependency resolution
  resolveDeps: adminProcedure
    .meta({
      description:
        "Resolve dependency mod IDs to names/thumbnails and check pack presence",
    })
    .input(
      z.object({
        packId: z.coerce.number().int().positive(),
        modIds: z.array(z.number().int().positive()).min(1),
      }),
    )
    .query(async ({ input }) => {
      const pack = await structurePackService.getPack(input.packId);
      const packModIds = new Set(pack.mods.map((m) => m.curseforgeModId));
      return resolveDependencies(input.modIds, packModIds);
    }),

  checkRemoveDeps: adminProcedure
    .meta({
      description:
        "Check which dependencies are safe to remove alongside a mod",
    })
    .input(
      z.object({
        packId: z.coerce.number().int().positive(),
        modId: z.coerce.number().int().positive(),
      }),
    )
    .query(async ({ input }) => {
      const pack = await structurePackService.getPack(input.packId);
      const targetMod = pack.mods.find((m) => m.id === input.modId);
      if (!targetMod) return { deps: [], dependents: [] };

      // Fetch dependency info for all pack mods
      const fileIds = pack.mods.map((m) => m.curseforgeFileId);
      const allFileDeps = await getFilesDependencies(fileIds);

      // Find which other pack mods depend on the target mod
      const dependents: Array<{ modName: string; relationType: number }> = [];
      for (const fileDep of allFileDeps) {
        if (fileDep.modId === targetMod.curseforgeModId) continue;
        for (const dep of fileDep.dependencies) {
          if (dep.modId === targetMod.curseforgeModId) {
            const packMod = pack.mods.find(
              (m) => m.curseforgeModId === fileDep.modId,
            );
            if (packMod) {
              dependents.push({
                modName: packMod.modName,
                relationType: dep.relationType,
              });
            }
          }
        }
      }

      // Find target mod's own dependencies
      const targetFileDeps = allFileDeps.find(
        (f) => f.fileId === targetMod.curseforgeFileId,
      );
      const targetDepModIds = new Set(
        (targetFileDeps?.dependencies ?? []).map((d) => d.modId),
      );

      if (targetDepModIds.size === 0) return { deps: [], dependents };

      // Build reverse dep map: depModId → set of pack curseforgeModIds that need it
      const reverseDeps = new Map<number, Set<number>>();
      for (const fileDep of allFileDeps) {
        for (const dep of fileDep.dependencies) {
          if (!targetDepModIds.has(dep.modId)) continue;
          if (!reverseDeps.has(dep.modId))
            reverseDeps.set(dep.modId, new Set());
          reverseDeps.get(dep.modId)!.add(fileDep.modId);
        }
      }

      // Filter to deps that are actually in the pack
      const packModIdSet = new Set(pack.mods.map((m) => m.curseforgeModId));
      const inPackDepIds = [...targetDepModIds].filter((id) =>
        packModIdSet.has(id),
      );

      if (inPackDepIds.length === 0) return { deps: [], dependents };

      // Resolve names for the deps
      const resolved = await resolveDependencies(inPackDepIds, packModIdSet);

      // Determine safety: a dep is safe to remove if no OTHER pack mod needs it
      return {
        dependents,
        deps: resolved.map((dep) => {
          const neededByModIds = reverseDeps.get(dep.modId) ?? new Set();
          const externalNeeders = [...neededByModIds].filter(
            (id) => id !== targetMod.curseforgeModId,
          );
          const neededByNames = externalNeeders
            .map(
              (id) =>
                pack.mods.find((m) => m.curseforgeModId === id)?.modName ?? "",
            )
            .filter(Boolean);

          return {
            modId: dep.modId,
            modName: dep.modName,
            safe: externalNeeders.length === 0,
            neededBy: neededByNames,
          };
        }),
      };
    }),

  // Import
  importPacks: adminProcedure
    .meta({ description: "Import structure packs from exported JSON" })
    .input(
      z.object({
        structurePacks: z.array(
          z.object({
            name: z.string().min(1).max(100),
            description: z.string().max(500).nullish(),
            enabled: z.boolean().optional().default(true),
            mods: z.array(
              z.object({
                curseforgeModId: z.number().int().positive(),
                curseforgeFileId: z.number().int().positive(),
                fileName: z.string().min(1),
                modName: z.string().min(1),
                modUrl: z.string().url().nullish(),
                thumbnailUrl: z.string().url().nullish(),
              }),
            ),
          }),
        ),
      }),
    )
    .mutation(async ({ input }) => {
      const created: string[] = [];
      const skipped: string[] = [];

      for (const packData of input.structurePacks) {
        try {
          const pack = await structurePackService.createPack(
            packData.name,
            packData.description ?? undefined,
          );

          await structurePackService.toggleEnabled(pack.id, false);

          for (const mod of packData.mods) {
            await structurePackService.addMod(pack.id, {
              curseforgeModId: mod.curseforgeModId,
              curseforgeFileId: mod.curseforgeFileId,
              fileName: mod.fileName,
              modName: mod.modName,
              modUrl: mod.modUrl ?? undefined,
              thumbnailUrl: mod.thumbnailUrl ?? undefined,
            });
          }

          created.push(packData.name);
        } catch {
          skipped.push(packData.name);
        }
      }

      return { created, skipped };
    }),

  // Rotation
  forceRotation: adminProcedure
    .meta({ description: "Trigger a manual rotation" })
    .mutation(async () => {
      const service = await getRotationService();
      await service.executeRotation(true);
      return { triggered: true };
    }),

  clearRotation: adminProcedure
    .meta({ description: "Clear the current rotation and remove active mods" })
    .mutation(async () => {
      const service = await getRotationService();
      await service.clearRotation();
      return { cleared: true };
    }),

  rotationHistory: adminProcedure
    .meta({ description: "Get paginated rotation history" })
    .input(z.object({ ...paginationInput() }))
    .query(async ({ input }) => {
      const service = await getRotationService();
      const { rows, total } = await service.getRotationHistory(
        input.limit,
        input.page * input.limit,
      );
      return {
        data: rows,
        pagination: buildPagination(input.page, input.limit, total),
      };
    }),

  // Rotation config
  rotationConfig: router({
    get: adminProcedure
      .meta({ description: "Get rotation schedule config" })
      .query(async () => {
        const service = await getRotationService();
        return service.getConfig();
      }),

    update: adminProcedure
      .meta({ description: "Update rotation schedule config" })
      .input(
        z.object({
          period: z.enum(["daily", "weekly", "monthly"]).optional(),
          dayOfWeek: z.number().int().min(0).max(6).optional(),
          dayOfMonth: z.number().int().min(1).max(28).optional(),
          time: z
            .string()
            .regex(/^\d{2}:\d{2}$/, "Time must be in HH:MM format")
            .optional(),
          timezone: z.string().min(1).optional(),
          boostUnitPrice: z.number().int().positive().optional(),
          timeWeightMultiplier: z.number().positive().optional(),
          boostWeightPerUnit: z.number().min(0).optional(),
          gracePeriodMinutes: z.number().int().min(0).optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const service = await getRotationService();
        return service.updateConfig(input);
      }),
  }),
});
