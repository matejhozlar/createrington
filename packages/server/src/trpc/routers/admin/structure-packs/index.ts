import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { structurePackService } from "@/services/structure-pack";
import { getService, Services } from "@/services";
import { searchMods, getModFiles } from "@/services/curseforge";
import { paginationInput, buildPagination } from "@/trpc/utils";
import type { StructurePackRotationService } from "@/services/structure-pack/rotation";

async function getRotationService(): Promise<StructurePackRotationService> {
  return getService(Services.STRUCTURE_PACK_ROTATION);
}

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

  // Rotation
  forceRotation: adminProcedure
    .meta({ description: "Trigger a manual rotation" })
    .mutation(async () => {
      const service = await getRotationService();
      await service.executeRotation(true);
      return { triggered: true };
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
