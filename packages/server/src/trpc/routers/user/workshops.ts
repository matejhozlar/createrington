import { z } from "zod";
import { router, userProcedure, middleware } from "@/trpc/trpc";
import { trpcError, rethrowTrpc } from "@/trpc/utils";
import { workshopService } from "@/services/workshop";
import { featureFlagService, FeatureFlags } from "@/services/feature-flag";

const id = () => z.number().int().positive().max(2147483647);

const requireWorkshopEnabled = middleware(async ({ next }) => {
  if (!(await featureFlagService.isEnabled(FeatureFlags.workshop))) {
    throw trpcError.forbidden("The workshop is currently disabled");
  }
  return next();
});

const workshopProcedure = userProcedure.use(requireWorkshopEnabled);

function redactMod<T extends { reviewedBy: string | null }>(
  mod: T,
): Omit<T, "reviewedBy"> {
  const { reviewedBy: _reviewedBy, ...rest } = mod;
  return rest;
}

export const userWorkshopsRouter = router({
  enabled: userProcedure
    .meta({ description: "Whether the workshop feature is enabled" })
    .query(async () => ({
      enabled: await featureFlagService.isEnabled(FeatureFlags.workshop),
    })),

  list: workshopProcedure
    .meta({ description: "List open and closed workshops" })
    .query(() => workshopService.listVisibleWorkshops()),

  get: workshopProcedure
    .meta({ description: "Get a workshop with its visible mods by slug" })
    .input(z.object({ slug: z.string().min(1).max(100) }))
    .query(async ({ input }) => {
      try {
        const workshop = await workshopService.getVisibleWorkshopBySlug(
          input.slug,
        );
        const mods = await workshopService.getWorkshopMods(workshop.id);
        return { workshop, mods: mods.map((m) => redactMod(m)) };
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  getMod: workshopProcedure
    .meta({ description: "Get a mod with its full project detail" })
    .input(z.object({ workshopModId: id() }))
    .query(async ({ input }) => {
      try {
        const detail = await workshopService.getModDetail(input.workshopModId);
        return { ...detail, mod: redactMod(detail.mod) };
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  searchProjects: workshopProcedure
    .meta({ description: "Search CurseForge for submittable projects" })
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
          {
            userVisible: true,
          },
        );
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  mySuggestions: workshopProcedure
    .meta({ description: "Your own suggestions in a workshop, all statuses" })
    .input(z.object({ workshopId: id() }))
    .query(async ({ ctx, input }) => {
      try {
        const mods = await workshopService.getMySuggestions(
          input.workshopId,
          ctx.user.discordId,
        );
        return mods.map((m) => redactMod(m));
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  mySuggestionHistory: workshopProcedure
    .meta({ description: "Your suggestions across all visible workshops" })
    .query(async ({ ctx }) => {
      try {
        const mods = await workshopService.getMySuggestionHistory(
          ctx.user.discordId,
        );
        return mods.map((m) => redactMod(m));
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  myUpvotes: workshopProcedure
    .meta({ description: "IDs of mods you have upvoted" })
    .input(z.object({ workshopId: id() }))
    .query(async ({ ctx, input }) => {
      try {
        return await workshopService.getMyUpvotes(
          input.workshopId,
          ctx.user.discordId,
        );
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  upvoteMod: workshopProcedure
    .meta({ description: "Toggle your upvote on a mod" })
    .input(z.object({ workshopModId: id() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await workshopService.toggleModUpvote(
          input.workshopModId,
          ctx.user.discordId,
        );
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  suggestMod: workshopProcedure
    .meta({ description: "Suggest a mod, using one of your slots" })
    .input(
      z.object({
        workshopId: id(),
        projectId: id(),
        note: z
          .string()
          .trim()
          .min(10, "Add a short sentence on why this mod belongs in the pack")
          .max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const mod = await workshopService.suggestMod(
          input.workshopId,
          ctx.user.discordId,
          { projectId: input.projectId, note: input.note },
        );
        return redactMod(mod);
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  removeSuggestion: workshopProcedure
    .meta({ description: "Remove your own pending suggestion" })
    .input(z.object({ workshopModId: id() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await workshopService.removeSuggestion(
          input.workshopModId,
          ctx.user.discordId,
        );
        return { removed: true };
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  listRejected: workshopProcedure
    .meta({ description: "Mods ruled out of a workshop, with reasons" })
    .input(z.object({ workshopId: id() }))
    .query(async ({ input }) => {
      try {
        const mods = await workshopService.getRejectedMods(input.workshopId);
        return mods.map((m) => redactMod(m));
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  pack: workshopProcedure
    .meta({
      description:
        "The workshop's modpack members with origin, credit, and live state",
    })
    .input(z.object({ workshopId: id() }))
    .query(async ({ input }) => {
      try {
        return await workshopService.getPackMods(input.workshopId, {
          userVisible: true,
        });
      } catch (error) {
        rethrowTrpc(error);
      }
    }),
});
