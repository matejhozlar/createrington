import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { auditActor, id, rethrowTrpc } from "@/trpc/utils";
import { workshopService } from "@/services/workshop";
import type { WorkshopModListItem } from "@/services/workshop";
import {
  logModRequired,
  logModReview,
  logProjectEnvironment,
} from "@/services/workshop/audit";
import {
  MOD_ENVIRONMENTS,
  type DependencyCoverage,
} from "@createrington/shared/workshop";
import type {
  ModEnvironment,
  ModEnvironmentSource,
  WorkshopModStatus,
} from "@createrington/shared/db";

export const SANDBOX_MOD_STATUSES = [
  "approved",
  "testing",
  "next_update",
] as const;

export const SANDBOX_REVIEW_ACTIONS = [
  "start_testing",
  "send_back",
  "approve",
] as const;

export interface SandboxModProject {
  id: number;
  classId: number;
  name: string;
  slug: string;
  summary: string | null;
  thumbnailUrl: string | null;
  websiteUrl: string | null;
  primaryAuthor: string | null;
  environment: ModEnvironment;
  environmentSource: ModEnvironmentSource | null;
  allowModDistribution: boolean | null;
}

export interface SandboxModFile {
  id: number;
  name: string | null;
  releaseType: number | null;
}

export interface SandboxModDependency {
  curseforgeProjectId: number;
  relationType: number;
  name: string | null;
  slug: string | null;
  coverage: DependencyCoverage;
}

export interface SandboxWorkshopMod {
  id: number;
  workshopId: number;
  status: WorkshopModStatus;
  curseforgeProjectId: number;
  project: SandboxModProject;
  file: SandboxModFile | null;
  required: boolean;
  note: string | null;
  submitterName: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  dependencies: SandboxModDependency[];
}

function toSandboxMod(item: WorkshopModListItem): SandboxWorkshopMod {
  return {
    id: item.id,
    workshopId: item.workshopId,
    status: item.status,
    curseforgeProjectId: item.curseforgeProjectId,
    project: {
      id: item.project.id,
      classId: item.project.classId,
      name: item.project.name,
      slug: item.project.slug,
      summary: item.project.summary,
      thumbnailUrl: item.project.thumbnailUrl,
      websiteUrl: item.project.websiteUrl,
      primaryAuthor: item.project.primaryAuthor,
      environment: item.project.environment,
      environmentSource: item.project.environmentSource,
      allowModDistribution: item.project.allowModDistribution,
    },
    file:
      item.fileId === null
        ? null
        : {
            id: item.fileId,
            name: item.fileName,
            releaseType: item.fileReleaseType,
          },
    required: item.required,
    note: item.note,
    submitterName: item.submitterName,
    reviewedAt: item.reviewedAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    dependencies: item.dependencies.map((dep) => ({
      curseforgeProjectId: dep.curseforgeProjectId,
      relationType: dep.relationType,
      name: dep.name,
      slug: dep.slug,
      coverage: dep.coverage,
    })),
  };
}

/** Sandbox consumer mods router: the testing queue of a workshop and the review actions a tester needs on it. */
export const sandboxModsRouter = router({
  list: adminProcedure
    .meta({
      description:
        "Lists a workshop's approved, testing, and next_update mods with their project, chosen file, environment, dependency coverage, and whether it should ship enabled (required, see setRequired), newest first. This is the sandbox's testing queue.",
    })
    .input(z.object({ workshopId: id() }))
    .query(async ({ input }) => {
      try {
        const items = await workshopService.getWorkshopMods(input.workshopId, {
          statuses: [...SANDBOX_MOD_STATUSES],
        });
        return { mods: items.map(toSandboxMod) };
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  review: adminProcedure
    .meta({
      description:
        "Moves a mod through the testing stages: start_testing (approved to testing), send_back (testing to approved, or next_update to testing), approve (testing to next_update). Runs the same gates as the main app and is refused with a 400 when one fails.",
    })
    .input(
      z.object({
        workshopModId: id(),
        action: z.enum(SANDBOX_REVIEW_ACTIONS),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const mod = await workshopService.reviewMod(
          input.workshopModId,
          input.action,
          ctx.user.discordId,
          { allowedFrom: [...SANDBOX_MOD_STATUSES] },
        );
        await logModReview(
          { ...auditActor(ctx), source: "sandbox" },
          input,
          mod,
        );
        const item = await workshopService.getWorkshopModListItem(mod.id);
        return { mod: toSandboxMod(item) };
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  setEnvironment: adminProcedure
    .meta({
      description:
        "Flags which side(s) a CurseForge project runs on; manual flags override CurseForge hints. Required before a mod can be approved for the next update.",
    })
    .input(
      z.object({
        curseforgeProjectId: id(),
        environment: z.enum(MOD_ENVIRONMENTS),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const project = await workshopService.setProjectEnvironment(
          input.curseforgeProjectId,
          input.environment,
        );
        await logProjectEnvironment(
          { ...auditActor(ctx), source: "sandbox" },
          project,
          input.environment,
        );
        return {
          project: {
            id: project.id,
            environment: project.environment,
            environmentSource: project.environmentSource,
          },
        };
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  setRequired: adminProcedure
    .meta({
      description:
        "Chooses whether a next_update mod ships enabled (required: true, the default) or disabled (required: false) in the next pack export; write the value into that mod's manifest entry. Refused with a 400 for mods in any other status, since the published manifest owns the flag once a mod is in the pack.",
    })
    .input(z.object({ workshopModId: id(), required: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const mod = await workshopService.setModRequired(
          input.workshopModId,
          input.required,
        );
        const item = await workshopService.getWorkshopModListItem(mod.id);
        await logModRequired(
          { ...auditActor(ctx), source: "sandbox" },
          mod,
          item.project.name,
        );
        return { mod: toSandboxMod(item) };
      } catch (error) {
        rethrowTrpc(error);
      }
    }),
});
