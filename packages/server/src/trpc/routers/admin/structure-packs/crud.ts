import { z } from "zod";
import { adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import { structurePackService } from "@/services/structure-pack";
import { modFileName } from "./helpers";

export const structurePackCrudProcedures = {
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
    .mutation(async ({ input, ctx }) => {
      const pack = await structurePackService.createPack(
        input.name,
        input.description,
      );
      await Q.admin.log.action.logAction({
        adminDiscordId: ctx.user.discordId,
        adminUsername: ctx.user.minecraftUsername,
        actionType: "structure_pack_create",
        description: `Created structure pack "${input.name}"`,
      });
      return pack;
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
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      const pack = await structurePackService.updatePack(id, data);
      await Q.admin.log.action.logAction({
        adminDiscordId: ctx.user.discordId,
        adminUsername: ctx.user.minecraftUsername,
        actionType: "structure_pack_update",
        description: `Updated structure pack #${id}`,
        metadata: { packId: id, changes: data },
      });
      return pack;
    }),

  delete: adminProcedure
    .meta({ description: "Soft-delete a structure pack" })
    .input(z.object({ id: z.coerce.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      await structurePackService.deletePack(input.id);
      await Q.admin.log.action.logAction({
        adminDiscordId: ctx.user.discordId,
        adminUsername: ctx.user.minecraftUsername,
        actionType: "structure_pack_delete",
        description: `Deleted structure pack #${input.id}`,
      });
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
    .mutation(async ({ input, ctx }) => {
      const pack = await structurePackService.toggleEnabled(
        input.id,
        input.enabled,
      );
      await Q.admin.log.action.logAction({
        adminDiscordId: ctx.user.discordId,
        adminUsername: ctx.user.minecraftUsername,
        actionType: "structure_pack_toggle",
        description: `${input.enabled ? "Enabled" : "Disabled"} structure pack #${input.id}`,
      });
      return pack;
    }),

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
                fileName: modFileName,
                modName: z.string().min(1),
                modUrl: z.string().url().nullish(),
                thumbnailUrl: z.string().url().nullish(),
              }),
            ),
          }),
        ),
      }),
    )
    .mutation(async ({ input, ctx }) => {
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

      await Q.admin.log.action.logAction({
        adminDiscordId: ctx.user.discordId,
        adminUsername: ctx.user.minecraftUsername,
        actionType: "structure_pack_import",
        description: `Imported ${created.length} structure packs (${skipped.length} skipped)`,
        metadata: { created, skipped },
      });

      return { created, skipped };
    }),
};
