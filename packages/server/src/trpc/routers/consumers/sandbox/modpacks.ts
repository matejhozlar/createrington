import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { id, rethrowTrpc } from "@/trpc/utils";
import { modpackService } from "@/services/modpack";
import type { ModpackModListItem } from "@/services/modpack";
import type {
  ModEnvironment,
  ModEnvironmentSource,
  ModpackModOrigin,
} from "@createrington/shared/db";

export interface SandboxPackModProject {
  id: number;
  classId: number;
  name: string;
  slug: string;
  thumbnailUrl: string | null;
  websiteUrl: string | null;
  primaryAuthor: string | null;
  environment: ModEnvironment;
  environmentSource: ModEnvironmentSource | null;
}

export interface SandboxPackMod {
  id: number;
  curseforgeProjectId: number;
  origin: ModpackModOrigin;
  workshopModId: number | null;
  project: SandboxPackModProject;
  file: { id: number; name: string | null; releaseType: number | null } | null;
  liveInVersion: string | null;
  liveAt: string | null;
}

function toSandboxPackMod(item: ModpackModListItem): SandboxPackMod {
  return {
    id: item.id,
    curseforgeProjectId: item.curseforgeProjectId,
    origin: item.origin,
    workshopModId: item.workshopModId,
    project: {
      id: item.project.id,
      classId: item.project.classId,
      name: item.project.name,
      slug: item.project.slug,
      thumbnailUrl: item.project.thumbnailUrl,
      websiteUrl: item.project.websiteUrl,
      primaryAuthor: item.project.primaryAuthor,
      environment: item.project.environment,
      environmentSource: item.project.environmentSource,
    },
    file:
      item.fileId === null
        ? null
        : {
            id: item.fileId,
            name: item.fileName,
            releaseType: item.fileReleaseType,
          },
    liveInVersion: item.liveInVersion,
    liveAt: item.liveAt?.toISOString() ?? null,
  };
}

/** Sandbox consumer modpacks router: what main says is in the published pack. */
export const sandboxModpacksRouter = router({
  listMods: adminProcedure
    .meta({
      description:
        "Lists the current members of a modpack as mirrored from its published CurseForge manifest, with the frozen file each one ships as and its environment. A manifest can list any CurseForge project class, so project.classId distinguishes mods (6) from shaders (6552) and resource packs (12), which the CurseForge app installs outside the mods folder. Mods the latest publish dropped are omitted.",
    })
    .input(z.object({ modpackId: id() }))
    .query(async ({ input }) => {
      try {
        const items = await modpackService.getPackMods(input.modpackId);
        return {
          mods: items
            .filter((item) => item.droppedFromManifestAt === null)
            .map(toSandboxPackMod),
        };
      } catch (error) {
        rethrowTrpc(error);
      }
    }),
});
