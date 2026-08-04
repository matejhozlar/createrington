import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import { auditActor, rethrowTrpc } from "@/trpc/utils";
import { workshopService } from "@/services/workshop";
import { modpackService } from "@/services/modpack";
import { listForumChannels } from "@/services/workshop/discord";
import { WORKSHOP_MOD_REJECT_REASONS } from "@createrington/shared/workshop";

const id = () => z.number().int().positive().max(2147483647);

const workshopPatch = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  status: z.enum(["draft", "open", "closed", "archived"]).optional(),
  gameVersion: z.string().trim().min(1).max(20).optional(),
  modLoaderType: z.number().int().min(0).optional(),
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
  list: adminProcedure
    .meta({ description: "List all workshops including drafts" })
    .query(() => workshopService.listAllWorkshops()),

  create: adminProcedure
    .meta({ description: "Create a workshop campaign" })
    .input(
      z.object({
        name: z.string().trim().min(1).max(120),
        slug: z
          .string()
          .trim()
          .min(1)
          .max(100)
          .regex(
            /^[a-z0-9-]+$/,
            "Slug may only contain lowercase letters, numbers, and hyphens",
          )
          .optional(),
        description: z.string().trim().max(2000).optional(),
        gameVersion: z.string().trim().min(1).max(20),
        modLoaderType: z.number().int().min(0),
        classId: id().optional(),
        baseModpackProjectId: id().optional(),
        modpackId: id(),
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
        "Review a mod: approve, or reject for this workshop with a reason",
    })
    .input(
      z
        .object({
          workshopModId: id(),
          action: z.enum(["approve", "reject"]),
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
          },
        });
        return mod;
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  addMods: adminProcedure
    .meta({
      description: "Add mods to a workshop as approved, bypassing review",
    })
    .input(
      z.object({
        workshopId: id(),
        projectIds: z.array(id()).min(1).max(20),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const mods = await workshopService.addModsAsAdmin(
          input.workshopId,
          input.projectIds,
          ctx.user.discordId,
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

  dependencyReport: adminProcedure
    .meta({
      description:
        "Dependency-pulled mods and optional dependencies for a workshop",
    })
    .input(z.object({ workshopId: id() }))
    .query(async ({ input }) => {
      try {
        return await workshopService.getDependencyReport(input.workshopId);
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  listForumChannels: adminProcedure
    .meta({ description: "Forum channels available for workshop threads" })
    .query(() => listForumChannels()),

  listPackMods: adminProcedure
    .meta({ description: "Members of the workshop's modpack" })
    .input(z.object({ workshopId: id() }))
    .query(async ({ input }) => {
      try {
        return await workshopService.getPackMods(input.workshopId);
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  attention: adminProcedure
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
});
