import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import { auditActor, rethrowTrpc } from "@/trpc/utils";
import { modpackService } from "@/services/modpack";

const id = () => z.number().int().positive().max(2147483647);

export const adminModpacksRouter = router({
  list: adminProcedure
    .meta({ description: "List all modpacks with member counts" })
    .query(() => modpackService.listModpacks()),

  create: adminProcedure
    .meta({ description: "Create a modpack" })
    .input(
      z.object({
        name: z.string().trim().min(1).max(120),
        description: z.string().trim().max(2000).optional(),
        curseforgeProjectId: id().optional(),
        serverId: id().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const modpack = await modpackService.createModpack(
          input,
          ctx.user.discordId,
        );
        await Q.admin.log.action.logAction({
          ...auditActor(ctx),
          actionType: "modpack_create",
          description: `Created modpack "${modpack.name}"`,
          metadata: { modpackId: modpack.id },
        });
        return modpack;
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  update: adminProcedure
    .meta({
      description:
        "Update a modpack; linking the published CurseForge project starts deriving live state",
    })
    .input(
      z.object({
        modpackId: id(),
        patch: z.object({
          name: z.string().trim().min(1).max(120).optional(),
          description: z.string().trim().max(2000).nullable().optional(),
          curseforgeProjectId: id().nullable().optional(),
          serverId: id().nullable().optional(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const modpack = await modpackService.updateModpack(
          input.modpackId,
          input.patch,
        );
        await Q.admin.log.action.logAction({
          ...auditActor(ctx),
          actionType: "modpack_update",
          description: `Updated modpack "${modpack.name}"`,
          metadata: { modpackId: modpack.id, patch: input.patch },
        });
        return modpack;
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  listMods: adminProcedure
    .meta({ description: "Members of a modpack with origin and live state" })
    .input(z.object({ modpackId: id() }))
    .query(async ({ input }) => {
      try {
        return await modpackService.getPackMods(input.modpackId);
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  removeMod: adminProcedure
    .meta({
      description:
        "Remove a directly-added member; suggestion members are removed by rejecting the suggestion",
    })
    .input(z.object({ modpackModId: id() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await modpackService.removePackMod(input.modpackModId);
        await Q.admin.log.action.logAction({
          ...auditActor(ctx),
          actionType: "modpack_mod_remove",
          description: `Removed modpack mod #${input.modpackModId}`,
          metadata: { modpackModId: input.modpackModId },
        });
        return { removed: true };
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  reconcile: adminProcedure
    .meta({
      description:
        "Re-derive live state from the published pack's manifest now",
    })
    .input(z.object({ modpackId: id() }))
    .mutation(async ({ input }) => {
      try {
        await modpackService.reconcile(input.modpackId);
        return { reconciled: true };
      } catch (error) {
        rethrowTrpc(error);
      }
    }),
});
