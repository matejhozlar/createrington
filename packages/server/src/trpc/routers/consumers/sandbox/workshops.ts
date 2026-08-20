import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import { id } from "@/trpc/utils";
import type {
  Modpack,
  ModpackRelease,
  Workshop,
  WorkshopStatus,
} from "@createrington/shared/db";

export interface SandboxWorkshopRelease {
  id: number;
  curseforgeFileId: number;
  version: string | null;
  displayName: string | null;
  minecraftVersion: string | null;
  modLoader: string | null;
  publishedAt: string | null;
}

export interface SandboxWorkshop {
  id: number;
  name: string;
  slug: string;
  status: WorkshopStatus;
  gameVersion: string;
  modLoaderType: number;
  classId: number;
  modpack: {
    id: number;
    name: string;
    curseforgeProjectId: number | null;
    latestRelease: SandboxWorkshopRelease | null;
  };
}

const LISTED_STATUSES = ["draft", "open", "closed"] as const;

function toSandboxWorkshop(
  workshop: Workshop,
  modpack: Modpack,
  latestRelease: ModpackRelease | undefined,
): SandboxWorkshop {
  return {
    id: workshop.id,
    name: workshop.name,
    slug: workshop.slug,
    status: workshop.status,
    gameVersion: workshop.gameVersion,
    modLoaderType: workshop.modLoaderType,
    classId: workshop.classId,
    modpack: {
      id: modpack.id,
      name: modpack.name,
      curseforgeProjectId: modpack.curseforgeProjectId,
      latestRelease: latestRelease
        ? {
            id: latestRelease.id,
            curseforgeFileId: latestRelease.curseforgeFileId,
            version: latestRelease.version,
            displayName: latestRelease.displayName,
            minecraftVersion: latestRelease.minecraftVersion,
            modLoader: latestRelease.modLoader,
            publishedAt: latestRelease.publishedAt?.toISOString() ?? null,
          }
        : null,
    },
  };
}

async function resolveSandboxWorkshops(
  workshops: Workshop[],
): Promise<SandboxWorkshop[]> {
  if (workshops.length === 0) return [];
  const modpackIds = [...new Set(workshops.map((w) => w.modpackId))];
  const [modpacks, releases] = await Promise.all([
    Q.modpack.findAll({ id: { $in: modpackIds } }),
    Q.modpack.release.latestPerModpack(modpackIds),
  ]);
  const modpackById = new Map(modpacks.map((m) => [m.id, m]));
  const releaseByModpackId = new Map(releases.map((r) => [r.modpackId, r]));

  return workshops.map((workshop) => {
    const modpack = modpackById.get(workshop.modpackId);
    if (!modpack) {
      throw new Error(
        `Workshop #${workshop.id} references missing modpack #${workshop.modpackId}`,
      );
    }
    return toSandboxWorkshop(
      workshop,
      modpack,
      releaseByModpackId.get(modpack.id),
    );
  });
}

/** Sandbox consumer workshops router: the workshops a sandbox instance can attach itself to, each with its modpack. */
export const sandboxWorkshopsRouter = router({
  list: adminProcedure
    .meta({
      description:
        "Lists draft, open, and closed workshops with their modpack and latest recorded release, newest first. The sandbox shows these in its workshop picker; archived workshops are omitted.",
    })
    .query(async () => {
      const workshops = await Q.workshop.findAll(
        { status: { $in: [...LISTED_STATUSES] } },
        { orderBy: "createdAt", orderDirection: "desc" },
      );
      return { workshops: await resolveSandboxWorkshops(workshops) };
    }),

  get: adminProcedure
    .meta({
      description:
        "Returns one workshop with its modpack and latest recorded release regardless of status, or null when it no longer exists, so a sandbox can re-resolve a stored selection and react to the workshop being archived or deleted since.",
    })
    .input(z.object({ id: id() }))
    .query(async ({ input }) => {
      const workshop = await Q.workshop.find({ id: input.id });
      if (!workshop) return { workshop: null };
      const [resolved] = await resolveSandboxWorkshops([workshop]);
      return { workshop: resolved ?? null };
    }),
});
