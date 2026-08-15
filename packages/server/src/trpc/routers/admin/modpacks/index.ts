import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import { auditActor, rethrowTrpc, id } from "@/trpc/utils";
import { modpackService } from "@/services/modpack";
import { modpackManifestUploadSchema } from "@createrington/shared/workshop";

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

  delete: adminProcedure
    .meta({
      description:
        "Delete a modpack no workshop uses, with its members and release history",
    })
    .input(z.object({ modpackId: id() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const { modpack, modCount, releaseCount } =
          await modpackService.deleteModpack(input.modpackId);
        await Q.admin.log.action.logAction({
          ...auditActor(ctx),
          actionType: "modpack_delete",
          description: `Deleted modpack "${modpack.name}" with ${modCount} member(s) and ${releaseCount} release(s)`,
          metadata: { modpackId: modpack.id, modCount, releaseCount },
        });
        return { deleted: true };
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

  listReleases: adminProcedure
    .meta({ description: "Recorded published releases of a modpack" })
    .input(z.object({ modpackId: id() }))
    .query(async ({ input }) => {
      try {
        return await modpackService.listReleases(input.modpackId);
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  getReleaseDiff: adminProcedure
    .meta({ description: "What a release changed against the one before it" })
    .input(z.object({ releaseId: id() }))
    .query(async ({ input }) => {
      try {
        return await modpackService.getReleaseDiff(input.releaseId);
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  listReleaseMods: adminProcedure
    .meta({ description: "Frozen membership of a recorded release" })
    .input(z.object({ releaseId: id() }))
    .query(async ({ input }) => {
      try {
        return await modpackService.getReleaseMods(input.releaseId);
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

  seedFromManifest: adminProcedure
    .meta({
      description:
        "Seed an unpublished pack's members from an uploaded manifest.json",
    })
    .input(z.object({ modpackId: id(), manifest: modpackManifestUploadSchema }))
    .mutation(async ({ ctx, input }) => {
      try {
        const { version, minecraft, files } = input.manifest;
        const loaders = minecraft?.modLoaders ?? [];
        const result = await modpackService.seedFromManifest(input.modpackId, {
          version: version ?? null,
          minecraftVersion: minecraft?.version ?? null,
          modLoader:
            (loaders.find((loader) => loader.primary) ?? loaders[0])?.id ??
            null,
          modIds: files.map((file) => file.projectID),
        });
        await Q.admin.log.action.logAction({
          ...auditActor(ctx),
          actionType: "modpack_seed_manifest",
          description: `Imported ${result.memberCount} mods into modpack #${input.modpackId} from a manifest`,
          metadata: { modpackId: input.modpackId, ...result },
        });
        return result;
      } catch (error) {
        rethrowTrpc(error);
      }
    }),
});
