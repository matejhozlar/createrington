import { z } from "zod";
import { router, ownerProcedure } from "@/trpc/trpc";
import { auditActor, id, rethrowTrpc } from "@/trpc/utils";
import { Q } from "@/db";
import {
  launcherPackService,
  type OwnedLauncherPack,
} from "@/services/launcher/pack/launcher-pack.service";
import { modpackService } from "@/services/modpack";
import type { LauncherPack } from "@createrington/shared/db";
import {
  LAUNCHER_PACK_SLUG_MAX_LENGTH,
  LAUNCHER_PACK_SLUG_PATTERN,
  LAUNCHER_PACK_SOURCES,
} from "@createrington/shared/launcher";

const ACTION_ADD = "launcher_pack_add";
const ACTION_ENABLE = "launcher_pack_enable";
const ACTION_REORDER = "launcher_pack_reorder";
const ACTION_REMOVE = "launcher_pack_remove";

const slug = z
  .string()
  .trim()
  .min(1)
  .max(LAUNCHER_PACK_SLUG_MAX_LENGTH)
  .regex(
    LAUNCHER_PACK_SLUG_PATTERN,
    "Lower-case letters, digits and single hyphens only",
  );

function toDto(pack: LauncherPack) {
  return {
    id: pack.id,
    slug: pack.slug,
    source: pack.source,
    position: pack.position,
    enabled: pack.enabled,
    createdAt: pack.createdAt.toISOString(),
  };
}

function toOwnedDto(pack: OwnedLauncherPack) {
  return {
    ...toDto(pack),
    modpack: pack.modpack,
    latestVersion: pack.latestVersion,
  };
}

export const ownerLauncherPacksRouter = router({
  list: ownerProcedure
    .meta({
      description:
        "Every pack the launcher is offered, in list order, with the modpack it points at and its newest ready release",
    })
    .query(async () => {
      const packs = await launcherPackService.listOwned();
      return { packs: packs.map(toOwnedDto) };
    }),

  candidates: ownerProcedure
    .meta({
      description: "Modpacks the launcher is not offered yet, to add one from",
    })
    .query(async () => ({
      modpacks: await launcherPackService.listCandidates(),
    })),

  add: ownerProcedure
    .meta({
      description:
        "Offer a modpack to the launcher under a new slug; a pack served from CurseForge gets its recorded releases prepared right away",
    })
    .input(
      z.object({
        slug,
        modpackId: id(),
        source: z.enum(LAUNCHER_PACK_SOURCES),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const pack = await launcherPackService.addPack(input);
        if (pack.source === "curseforge") {
          void modpackService.tryReconcile(pack.modpackId);
        }
        await Q.admin.log.action.logAction({
          ...auditActor(ctx),
          actionType: ACTION_ADD,
          description: `Offered modpack #${pack.modpackId} to the launcher as "${pack.slug}" (${pack.source})`,
          metadata: { launcherPackId: pack.id, ...input },
        });
        return toDto(pack);
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  setEnabled: ownerProcedure
    .meta({
      description:
        "Show or hide a pack in the launcher's list; its releases keep being prepared either way",
    })
    .input(z.object({ id: id(), enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const pack = await launcherPackService.setPackEnabled(
          input.id,
          input.enabled,
        );
        await Q.admin.log.action.logAction({
          ...auditActor(ctx),
          actionType: ACTION_ENABLE,
          description: `${pack.enabled ? "Enabled" : "Disabled"} the launcher pack "${pack.slug}"`,
          metadata: { launcherPackId: pack.id, enabled: pack.enabled },
        });
        return toDto(pack);
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  reorder: ownerProcedure
    .meta({
      description:
        "Put the packs in this order in the launcher's list; names every pack exactly once",
    })
    .input(z.object({ ids: z.array(id()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        const packs = await launcherPackService.reorderPacks(input.ids);
        await Q.admin.log.action.logAction({
          ...auditActor(ctx),
          actionType: ACTION_REORDER,
          description: `Reordered the launcher packs: ${packs.map((pack) => pack.slug).join(", ")}`,
          metadata: { ids: input.ids },
        });
        return { packs: packs.map(toDto) };
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  remove: ownerProcedure
    .meta({
      description:
        "Stop offering a pack; launchers that stored its slug lose it",
    })
    .input(z.object({ id: id() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const pack = await launcherPackService.removePack(input.id);
        await Q.admin.log.action.logAction({
          ...auditActor(ctx),
          actionType: ACTION_REMOVE,
          description: `Stopped offering the launcher pack "${pack.slug}" (modpack #${pack.modpackId})`,
          metadata: { launcherPackId: pack.id, slug: pack.slug },
        });
        return toDto(pack);
      } catch (error) {
        rethrowTrpc(error);
      }
    }),
});
