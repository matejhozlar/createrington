import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import { auditActor, rethrowTrpc } from "@/trpc/utils";
import { voteService } from "@/services/vote";
import { listForumChannels } from "@/services/vote/discord";

const votePatch = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  status: z.enum(["draft", "open", "closed", "archived"]).optional(),
  gameVersion: z.string().trim().min(1).max(20).optional(),
  modLoaderType: z.number().int().min(0).optional(),
  classId: z.number().int().positive().optional(),
  baseModpackProjectId: z.number().int().positive().nullable().optional(),
  maxModsPerUser: z.number().int().min(1).max(25).optional(),
  maxUpvotesPerUser: z.number().int().min(1).max(100).optional(),
  discordForumChannelId: z
    .string()
    .trim()
    .regex(/^\d{17,20}$/, "Must be a Discord channel ID")
    .nullable()
    .optional(),
});

export const adminVotesRouter = router({
  list: adminProcedure
    .meta({ description: "List all votes including drafts" })
    .query(() => voteService.listAllVotes()),

  create: adminProcedure
    .meta({ description: "Create a vote campaign" })
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
        classId: z.number().int().positive().optional(),
        baseModpackProjectId: z.number().int().positive().optional(),
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
        const vote = await voteService.createVote(input, ctx.user.discordId);
        await Q.admin.log.action.logAction({
          ...auditActor(ctx),
          actionType: "vote_create",
          description: `Created vote "${vote.name}"`,
          metadata: { voteId: vote.id, slug: vote.slug },
        });
        return vote;
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  update: adminProcedure
    .meta({ description: "Update a vote's settings or lifecycle status" })
    .input(z.object({ voteId: z.number().int().positive(), patch: votePatch }))
    .mutation(async ({ ctx, input }) => {
      try {
        const vote = await voteService.updateVote(input.voteId, input.patch);
        await Q.admin.log.action.logAction({
          ...auditActor(ctx),
          actionType: "vote_update",
          description: `Updated vote "${vote.name}"`,
          metadata: { voteId: vote.id, patch: input.patch },
        });
        return vote;
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  listMods: adminProcedure
    .meta({ description: "List every mod in a vote, all statuses" })
    .input(z.object({ voteId: z.number().int().positive() }))
    .query(async ({ input }) => {
      try {
        return await voteService.getVoteMods(input.voteId, {
          includeHidden: true,
        });
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  getMod: adminProcedure
    .meta({ description: "Get a mod with its full project detail" })
    .input(z.object({ voteModId: z.number().int().positive() }))
    .query(async ({ input }) => {
      try {
        return await voteService.getModDetail(input.voteModId, {
          includeHidden: true,
        });
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  searchProjects: adminProcedure
    .meta({ description: "Search CurseForge for projects to add to a vote" })
    .input(
      z.object({
        voteId: z.number().int().positive(),
        query: z.string().trim().min(2).max(100),
      }),
    )
    .query(async ({ input }) => {
      try {
        return await voteService.searchProjects(input.voteId, input.query);
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
          voteModId: z.number().int().positive(),
          action: z.enum(["approve", "reject"]),
          reason: z
            .enum([
              "on_hold",
              "incompatible",
              "covered_by_other_mod",
              "not_a_good_fit",
            ])
            .optional(),
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
        const mod = await voteService.reviewMod(
          input.voteModId,
          input.action,
          ctx.user.discordId,
          { reason: input.reason, note: input.note },
        );
        await Q.admin.log.action.logAction({
          ...auditActor(ctx),
          actionType: `vote_mod_${input.action}`,
          description: `Reviewed vote mod #${input.voteModId}: ${input.action}`,
          reason: [input.reason, input.note].filter(Boolean).join(": "),
          metadata: {
            voteModId: input.voteModId,
            curseforgeProjectId: mod.curseforgeProjectId,
          },
        });
        return mod;
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  addMods: adminProcedure
    .meta({ description: "Add mods to a vote as approved, bypassing review" })
    .input(
      z.object({
        voteId: z.number().int().positive(),
        projectIds: z.array(z.number().int().positive()).min(1).max(20),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const mods = await voteService.addModsAsAdmin(
          input.voteId,
          input.projectIds,
          ctx.user.discordId,
        );
        await Q.admin.log.action.logAction({
          ...auditActor(ctx),
          actionType: "vote_mods_admin_add",
          description: `Added ${mods.length} mod(s) to vote #${input.voteId}`,
          metadata: { voteId: input.voteId, projectIds: input.projectIds },
        });
        return mods;
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  dependencyReport: adminProcedure
    .meta({
      description:
        "Dependency-pulled mods and optional dependencies for a vote",
    })
    .input(z.object({ voteId: z.number().int().positive() }))
    .query(async ({ input }) => {
      try {
        return await voteService.getDependencyReport(input.voteId);
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  listForumChannels: adminProcedure
    .meta({ description: "Forum channels available for workshop threads" })
    .query(() => listForumChannels()),
});
