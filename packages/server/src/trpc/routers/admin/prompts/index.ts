import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import { paginationInput, buildPagination, trpcError } from "@/trpc/utils";
import { getServiceSync, Services } from "@/services";
import { Discord } from "@/discord/constants";

const MAX_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MIN_DURATION_MS = 60 * 1000; // 1 minute — guards against accidental zero-duration prompts

const createInput = z.object({
  question: z.string().min(1).max(256),
  description: z.string().max(2000).optional(),
  durationMs: z.number().int().min(MIN_DURATION_MS).max(MAX_DURATION_MS),
  rolePingId: z.string().regex(/^\d+$/).optional(),
});

/**
 * Admin Player Prompt router.
 *
 * Owns the admin-facing surface for creating, listing, and inspecting
 * player prompts. The actual Discord post + timer scheduling lives in
 * PlayerPromptService — this router is only a thin validation layer.
 */
export const adminPromptsRouter = router({
  list: adminProcedure
    .meta({
      description:
        "Paginated list of player prompts with response counts. Newest first.",
    })
    .input(
      z.object({
        status: z.enum(["active", "closed"]).optional(),
        ...paginationInput(),
      }),
    )
    .query(async ({ input }) => {
      const offset = input.page * input.limit;
      const rows = await Q.player.prompt.listWithResponseCount({
        limit: input.limit,
        offset,
        status: input.status,
      });
      const total = await Q.player.prompt.count(
        input.status ? { status: input.status } : {},
      );
      return {
        items: rows,
        pagination: buildPagination(input.page, input.limit, total),
      };
    }),

  get: adminProcedure
    .meta({
      description:
        "Fetch a single prompt with all its responses joined to player rows.",
    })
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const prompt = await Q.player.prompt.find({ id: input.id });
      if (!prompt) throw trpcError.notFound("Prompt not found");
      const responses = await Q.player.prompt.response.findByPromptIdWithPlayer(
        input.id,
      );
      return { prompt, responses };
    }),

  create: adminProcedure
    .meta({
      description:
        "Post a new prompt to the announcements channel with a Respond button.",
    })
    .input(createInput)
    .mutation(async ({ input, ctx }) => {
      const service = getServiceSync(Services.PLAYER_PROMPT_SERVICE);
      const prompt = await service.createPrompt({
        question: input.question,
        description: input.description ?? null,
        durationMs: input.durationMs,
        rolePingId: input.rolePingId ?? null,
        channelId: Discord.Channels.createringtonOfficial.ANNOUNCEMENTS,
        createdBy: ctx.user.discordId,
      });

      await Q.admin.log.action.logAction({
        adminDiscordId: ctx.user.discordId,
        adminUsername: ctx.user.minecraftUsername,
        actionType: "player_prompt_create",
        description: `Created player prompt "${input.question.slice(0, 80)}"`,
        metadata: { promptId: prompt.id },
      });

      return { prompt };
    }),

  close: adminProcedure
    .meta({
      description:
        "Manually close an active prompt and edit its Discord message to a closed state.",
    })
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const service = getServiceSync(Services.PLAYER_PROMPT_SERVICE);
      await service.closePrompt(input.id);

      await Q.admin.log.action.logAction({
        adminDiscordId: ctx.user.discordId,
        adminUsername: ctx.user.minecraftUsername,
        actionType: "player_prompt_close",
        description: `Manually closed player prompt #${input.id}`,
        metadata: { promptId: input.id },
      });

      return { ok: true };
    }),
});
