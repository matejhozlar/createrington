import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import { id, rethrowTrpc } from "@/trpc/utils";
import {
  logModReview,
  workshopModReviewInput,
} from "@/trpc/shared/workshop-review";
import { workshopService } from "@/services/workshop";
import type { WorkshopModListItem } from "@/services/workshop";
import type {
  ModEnvironment,
  Modpack,
  ModpackRelease,
  Workshop,
  WorkshopModRejectReason,
  WorkshopModStatus,
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

const SANDBOX_MOD_STATUSES = [
  "approved",
  "testing",
  "next_update",
] as const satisfies readonly WorkshopModStatus[];

const SANDBOX_FILTERABLE_STATUSES = [
  ...SANDBOX_MOD_STATUSES,
  "rejected",
] as const satisfies readonly WorkshopModStatus[];

export interface SandboxModCategory {
  id: number;
  name: string;
  slug: string;
  iconUrl: string | null;
}

export interface SandboxWorkshopMod {
  id: number;
  workshopId: number;
  status: WorkshopModStatus;
  note: string | null;
  submittedBy: string;
  submitterName: string | null;
  reviewedBy: string | null;
  reviewerName: string | null;
  reviewedAt: string | null;
  rejectReason: WorkshopModRejectReason | null;
  rejectNote: string | null;
  createdAt: string;
  updatedAt: string;
  upvoteCount: number;
  project: {
    curseforgeProjectId: number;
    name: string;
    slug: string;
    summary: string | null;
    thumbnailUrl: string | null;
    websiteUrl: string | null;
    primaryAuthor: string | null;
    downloadCount: number;
    categories: SandboxModCategory[];
    environment: ModEnvironment;
  };
}

function toSandboxCategories(categories: unknown): SandboxModCategory[] {
  if (!Array.isArray(categories)) return [];
  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    iconUrl: category.iconUrl ?? null,
  }));
}

function toSandboxWorkshopMod(mod: WorkshopModListItem): SandboxWorkshopMod {
  return {
    id: mod.id,
    workshopId: mod.workshopId,
    status: mod.status,
    note: mod.note,
    submittedBy: mod.submittedBy,
    submitterName: mod.submitterName,
    reviewedBy: mod.reviewedBy,
    reviewerName: mod.reviewerName,
    reviewedAt: mod.reviewedAt?.toISOString() ?? null,
    rejectReason: mod.rejectReason,
    rejectNote: mod.rejectNote,
    createdAt: mod.createdAt.toISOString(),
    updatedAt: mod.updatedAt.toISOString(),
    upvoteCount: mod.upvoteCount,
    project: {
      curseforgeProjectId: mod.project.id,
      name: mod.project.name,
      slug: mod.project.slug,
      summary: mod.project.summary,
      thumbnailUrl: mod.project.thumbnailUrl,
      websiteUrl: mod.project.websiteUrl,
      primaryAuthor: mod.project.primaryAuthor,
      downloadCount: mod.project.downloadCount,
      categories: toSandboxCategories(mod.project.categories),
      environment: mod.project.environment,
    },
  };
}

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

  listMods: adminProcedure
    .meta({
      description:
        "Lists a workshop's mods in the sandbox-relevant stages (approved, in testing, coming next update), newest first, each with its CurseForge project info (id, name, slug, summary, logo, author, downloads, categories, environment) and upvote count. Pass statuses to narrow to a subset (rejected is available for recovery); omit it for the three active stages.",
    })
    .input(
      z.object({
        workshopId: id(),
        statuses: z
          .array(z.enum(SANDBOX_FILTERABLE_STATUSES))
          .min(1)
          .optional(),
      }),
    )
    .query(async ({ input }) => {
      try {
        const mods = await workshopService.getWorkshopMods(input.workshopId, {
          statuses: input.statuses ?? [...SANDBOX_MOD_STATUSES],
        });
        return { mods: mods.map(toSandboxWorkshopMod) };
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  reviewMod: adminProcedure
    .meta({
      description:
        "Moves a mod to its next state following the same review pipeline as the main app: approve, start testing, send back a stage, or reject with a reason. Accepts any mod id the caller holds, including stages listMods does not surface (a pending mod, or recovering a rejected one), so the full transition table applies. The transition is validated server side and posts to the mod's Discord thread, exactly as an in-app review does. Returns the updated mod in the same shape as listMods.",
    })
    .input(workshopModReviewInput)
    .mutation(async ({ ctx, input }) => {
      try {
        const mod = await workshopService.reviewMod(
          input.workshopModId,
          input.action,
          ctx.user.discordId,
          { reason: input.reason, note: input.note },
        );
        await logModReview(ctx, input, mod, "sandbox");
        const updated = await workshopService.getWorkshopMod(
          input.workshopModId,
        );
        return { mod: toSandboxWorkshopMod(updated) };
      } catch (error) {
        rethrowTrpc(error);
      }
    }),
});
