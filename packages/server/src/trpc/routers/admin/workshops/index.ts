import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import { auditActor, rethrowTrpc, id } from "@/trpc/utils";
import { createRateLimit } from "@/trpc/middleware/rate-limit";
import { workshopService } from "@/services/workshop";
import { modpackService } from "@/services/modpack";
import { getMinecraftVersions } from "@/services/curseforge";
import { listForumChannels } from "@/services/workshop/discord";
import { adminWorkshopBansRouter } from "./bans";
import {
  MOD_ENVIRONMENTS,
  MOD_ENVIRONMENT_LABELS,
  WORKSHOP_MOD_REJECT_REASONS,
  WORKSHOP_MOD_REVIEW_ACTIONS,
  WORKSHOP_STATUSES,
} from "@createrington/shared/workshop";

const searchLimit = createRateLimit({
  name: "admin.workshops.searchProjects",
  limit: 30,
  windowMs: 60 * 1000,
  key: (ctx) => ctx.user?.discordId ?? "anonymous",
});

const workshopSlug = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(
    /^[a-z0-9-]+$/,
    "Slug may only contain lowercase letters, numbers, and hyphens",
  );

const workshopPatch = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  slug: workshopSlug.optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  status: z.enum(WORKSHOP_STATUSES).optional(),
  classId: id().optional(),
  baseModpackProjectId: id().nullable().optional(),
  modpackId: id().optional(),
  maxModsPerUser: z.number().int().min(1).max(25).optional(),
  maxUpvotesPerUser: z.number().int().min(1).max(100).optional(),
  discordForumChannelId: z
    .string()
    .trim()
    .regex(/^\d{17,20}$/, "Must be a Discord channel ID")
    .nullable()
    .optional(),
});

export const adminWorkshopsRouter = router({
  bans: adminWorkshopBansRouter,

  list: adminProcedure
    .meta({ description: "List all workshops including drafts" })
    .query(() => workshopService.listAllWorkshops()),

  create: adminProcedure
    .meta({ description: "Create a workshop campaign" })
    .input(
      z.object({
        name: z.string().trim().min(1).max(120),
        slug: workshopSlug.optional(),
        description: z.string().trim().max(2000).optional(),
        gameVersion: z.string().trim().min(1).max(20),
        modLoaderType: z.number().int().min(0),
        classId: id().optional(),
        baseModpackProjectId: id().optional(),
        modpackId: id().optional(),
        newModpackName: z.string().trim().min(1).max(120).optional(),
        maxModsPerUser: z.number().int().min(1).max(25).optional(),
        maxUpvotesPerUser: z.number().int().min(1).max(100).optional(),
        discordForumChannelId: z
          .string()
          .trim()
          .regex(/^\d{17,20}$/, "Must be a Discord channel ID")
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const workshop = await workshopService.createWorkshop(
          input,
          ctx.user.discordId,
        );
        await Q.admin.log.action.logAction({
          ...auditActor(ctx),
          actionType: "workshop_create",
          description: `Created workshop "${workshop.name}"`,
          metadata: { workshopId: workshop.id, slug: workshop.slug },
        });
        return workshop;
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  update: adminProcedure
    .meta({ description: "Update a workshop's settings or lifecycle status" })
    .input(
      z.object({
        workshopId: id(),
        patch: workshopPatch,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const workshop = await workshopService.updateWorkshop(
          input.workshopId,
          input.patch,
        );
        await Q.admin.log.action.logAction({
          ...auditActor(ctx),
          actionType: "workshop_update",
          description: `Updated workshop "${workshop.name}"`,
          metadata: { workshopId: workshop.id, patch: input.patch },
        });
        return workshop;
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  delete: adminProcedure
    .meta({
      description:
        "Delete an archived workshop with its suggestions, votes, and history",
    })
    .input(z.object({ workshopId: id() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const workshop = await workshopService.deleteWorkshop(input.workshopId);
        await Q.admin.log.action.logAction({
          ...auditActor(ctx),
          actionType: "workshop_delete",
          description: `Deleted workshop "${workshop.name}"`,
          metadata: { workshopId: workshop.id, slug: workshop.slug },
        });
        return { deleted: true };
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  listMods: adminProcedure
    .meta({ description: "List every mod in a workshop, all statuses" })
    .input(z.object({ workshopId: id() }))
    .query(async ({ input }) => {
      try {
        return await workshopService.getWorkshopMods(input.workshopId, {
          includeHidden: true,
        });
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  getMod: adminProcedure
    .meta({ description: "Get a mod with its full project detail" })
    .input(z.object({ workshopModId: id() }))
    .query(async ({ input }) => {
      try {
        return await workshopService.getModDetail(input.workshopModId, {
          includeHidden: true,
        });
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  searchProjects: adminProcedure
    .use(searchLimit)
    .meta({
      description: "Search CurseForge for projects to add to a workshop",
    })
    .input(
      z.object({
        workshopId: id(),
        query: z.string().trim().min(2).max(100),
      }),
    )
    .query(async ({ input }) => {
      try {
        return await workshopService.searchProjects(
          input.workshopId,
          input.query,
        );
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  reviewMod: adminProcedure
    .meta({
      description:
        "Review a mod: approve, move it to testing, send it back a stage, or reject for this workshop with a reason",
    })
    .input(
      z
        .object({
          workshopModId: id(),
          action: z.enum(WORKSHOP_MOD_REVIEW_ACTIONS),
          reason: z.enum(WORKSHOP_MOD_REJECT_REASONS).optional(),
          note: z.string().trim().max(500).optional(),
        })
        .superRefine((data, ctx) => {
          if (data.action === "reject" && !data.reason) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["reason"],
              message: "Rejecting requires a reason",
            });
          }
        }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const mod = await workshopService.reviewMod(
          input.workshopModId,
          input.action,
          ctx.user.discordId,
          { reason: input.reason, note: input.note },
        );
        await Q.admin.log.action.logAction({
          ...auditActor(ctx),
          actionType: `workshop_mod_${input.action}`,
          description: `Reviewed workshop mod #${input.workshopModId}: ${input.action}`,
          reason: [input.reason, input.note].filter(Boolean).join(": "),
          metadata: {
            workshopModId: input.workshopModId,
            curseforgeProjectId: mod.curseforgeProjectId,
            status: mod.status,
          },
        });
        return mod;
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  setProjectEnvironment: adminProcedure
    .meta({
      description:
        "Flag which side(s) a CurseForge project runs on; manual flags override CurseForge hints",
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
        await Q.admin.log.action.logAction({
          ...auditActor(ctx),
          actionType: "workshop_project_environment",
          description: `Flagged "${project.name}" as ${MOD_ENVIRONMENT_LABELS[input.environment]}`,
          metadata: {
            curseforgeProjectId: input.curseforgeProjectId,
            environment: input.environment,
          },
        });
        return project;
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  addMods: adminProcedure
    .meta({
      description: "Add mods to a workshop as suggestions that are approved",
    })
    .input(
      z.object({
        workshopId: id(),
        projectIds: z.array(id()).min(1).max(20),
        note: z.string().trim().min(10).max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const mods = await workshopService.addModsAsAdmin(
          input.workshopId,
          input.projectIds,
          ctx.user.discordId,
          input.note,
        );
        await Q.admin.log.action.logAction({
          ...auditActor(ctx),
          actionType: "workshop_mods_admin_add",
          description: `Added ${mods.length} mod(s) to workshop #${input.workshopId}`,
          metadata: {
            workshopId: input.workshopId,
            projectIds: input.projectIds,
          },
        });
        return mods;
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  listForumChannels: adminProcedure
    .meta({ description: "Forum channels available for workshop threads" })
    .query(() => listForumChannels()),

  listGameVersions: adminProcedure
    .meta({ description: "Minecraft versions a workshop can target" })
    .query(async () => {
      try {
        return await getMinecraftVersions();
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  listPackMods: adminProcedure
    .meta({ description: "The published pack's contents" })
    .input(z.object({ workshopId: id() }))
    .query(async ({ input }) => {
      try {
        return await workshopService.getPackMods(input.workshopId);
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  getAttention: adminProcedure
    .meta({
      description:
        "Contradictions between the workshop and the published pack that need an admin decision",
    })
    .input(z.object({ workshopId: id() }))
    .query(async ({ input }) => {
      try {
        const workshop = await workshopService.getWorkshop(input.workshopId);
        return await modpackService.getWorkshopAttention(workshop);
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  listDependencies: adminProcedure
    .meta({
      description:
        "Workshop-wide dependency coverage, one row per depended-on project",
    })
    .input(z.object({ workshopId: id() }))
    .query(async ({ input }) => {
      try {
        return await workshopService.getWorkshopDependencies(input.workshopId);
      } catch (error) {
        rethrowTrpc(error);
      }
    }),
});
