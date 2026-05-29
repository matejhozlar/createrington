import { z } from "zod";
import { adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import { structurePackService } from "@/services/structure-pack";
import {
  searchMods,
  getModFiles,
  resolveDependencies,
  getFilesDependencies,
} from "@/services/curseforge";
import { modFileName, getRotationService } from "./helpers";

export const structurePackModProcedures = {
  addMod: adminProcedure
    .meta({ description: "Add a CurseForge mod to a structure pack" })
    .input(
      z.object({
        packId: z.coerce.number().int().positive(),
        curseforgeModId: z.number().int().positive(),
        curseforgeFileId: z.number().int().positive(),
        fileName: modFileName,
        modName: z.string().min(1),
        modUrl: z.string().url().optional(),
        thumbnailUrl: z.string().url().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // Validate the download URL is resolvable before persisting
      const rotationService = await getRotationService();
      await rotationService.validateModDownloadable(
        input.curseforgeModId,
        input.curseforgeFileId,
      );
      const { packId, ...modData } = input;
      const mod = await structurePackService.addMod(packId, modData);
      await Q.admin.log.action.logAction({
        adminDiscordId: ctx.user.discordId,
        adminUsername: ctx.user.minecraftUsername,
        actionType: "structure_pack_add_mod",
        description: `Added mod "${input.modName}" to pack #${packId}`,
        metadata: { packId, modName: input.modName },
      });
      return mod;
    }),

  removeMod: adminProcedure
    .meta({ description: "Remove a mod from a structure pack" })
    .input(
      z.object({
        packId: z.coerce.number().int().positive(),
        modId: z.coerce.number().int().positive(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await structurePackService.removeMod(input.packId, input.modId);
      await Q.admin.log.action.logAction({
        adminDiscordId: ctx.user.discordId,
        adminUsername: ctx.user.minecraftUsername,
        actionType: "structure_pack_remove_mod",
        description: `Removed mod #${input.modId} from pack #${input.packId}`,
      });
      return { removed: true };
    }),

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
};
