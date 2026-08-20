import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import { id, trpcError } from "@/trpc/utils";
import type { Workshop } from "@createrington/shared/db";

const LISTED_STATUSES = ["open", "closed"] as const;

async function toSandboxWorkshop(workshop: Workshop) {
  const modpack = await Q.modpack.get({ id: workshop.modpackId });
  const [latestRelease] = await Q.modpack.release.findAll(
    { modpackId: modpack.id },
    { orderBy: "id", orderDirection: "desc", limit: 1 },
  );

  return {
    id: workshop.id,
    name: workshop.name,
    slug: workshop.slug,
    status: workshop.status,
    gameVersion: workshop.gameVersion,
    modLoaderType: workshop.modLoaderType,
    classId: workshop.classId,
    baseModpackProjectId: workshop.baseModpackProjectId,
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

/** Sandbox consumer workshops router: the workshops a sandbox instance can attach itself to, each with its modpack. */
export const sandboxWorkshopsRouter = router({
  list: adminProcedure
    .meta({
      description:
        "Lists open and closed workshops with their modpack and latest recorded release, newest first. The sandbox shows these in its workshop picker; drafts and archived workshops are omitted.",
    })
    .query(async () => {
      const workshops = await Q.workshop.findAll(
        { status: { $in: [...LISTED_STATUSES] } },
        { orderBy: "createdAt", orderDirection: "desc" },
      );
      return { workshops: await Promise.all(workshops.map(toSandboxWorkshop)) };
    }),

  get: adminProcedure
    .meta({
      description:
        "Returns one workshop with its modpack and latest recorded release, regardless of status, so a sandbox can re-resolve a stored selection and react to the workshop being closed or archived since.",
    })
    .input(z.object({ id: id() }))
    .query(async ({ input }) => {
      const workshop = await Q.workshop.find({ id: input.id });
      if (!workshop) throw trpcError.notFound("Workshop not found");
      return toSandboxWorkshop(workshop);
    }),
});
