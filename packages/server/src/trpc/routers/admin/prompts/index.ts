import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import {
  paginationInput,
  buildPagination,
  trpcError,
  auditActor,
} from "@/trpc/utils";
import { getServiceSync, Services } from "@/services";
import { Discord } from "@/discord/constants";
import {
  MAX_ENTRIES_PER_PLAYER,
  MAX_PROMPT_COOLDOWN_SECONDS,
  MIN_ENTRIES_PER_PLAYER,
  PLAYER_PROMPT_ENTRY_MODES,
} from "@createrington/shared/player-prompt";

const MAX_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MIN_DURATION_MS = 60 * 1000; // 1 minute, guards against accidental zero-duration prompts

const createInput = z
  .object({
    // Collapsed to one line: the question renders as a markdown heading on
    // the Discord card, which a newline would break out of.
    question: z
      .string()
      .max(256)
      .transform((value) => value.replace(/\s+/g, " ").trim())
      .pipe(z.string().min(1)),
    description: z.string().max(2000).optional(),
    durationMs: z.number().int().min(MIN_DURATION_MS).max(MAX_DURATION_MS),
    rolePingId: z.string().regex(/^\d+$/).optional(),
    // Optional, defaults to the announcements channel. Admins can target
    // any configured channel via the client picker.
    channelId: z.string().regex(/^\d+$/).optional(),
    entryMode: z.enum(PLAYER_PROMPT_ENTRY_MODES).default("single"),
    // Multi mode only. Omit for unlimited entries / no cooldown.
    maxEntries: z
      .number()
      .int()
      .min(MIN_ENTRIES_PER_PLAYER)
      .max(MAX_ENTRIES_PER_PLAYER)
      .optional(),
    cooldownSeconds: z
      .number()
      .int()
      .min(1)
      .max(MAX_PROMPT_COOLDOWN_SECONDS)
      .optional(),
  })
  .refine(
    (input) =>
      input.entryMode === "multi" ||
      (input.maxEntries === undefined && input.cooldownSeconds === undefined),
    {
      message: "maxEntries and cooldownSeconds require entryMode 'multi'",
      path: ["entryMode"],
    },
  );

/**
 * Admin Player Prompt router.
 *
 * Owns the admin-facing surface for creating, listing, and inspecting
 * player prompts. The actual Discord post + timer scheduling lives in
 * PlayerPromptService, this router is only a thin validation layer.
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
      // Resolve the creator's Minecraft username so the detail page can
      // show a human-readable author instead of a raw Discord snowflake.
      const creator = await Q.player.find({ discordId: prompt.createdBy });
      return {
        prompt,
        responses,
        creator: creator
          ? { minecraftUsername: creator.minecraftUsername }
          : null,
      };
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
        channelId:
          input.channelId ??
          Discord.Channels.createringtonOfficial.ANNOUNCEMENTS,
        createdBy: ctx.user.discordId,
        entryMode: input.entryMode,
        maxEntries: input.maxEntries ?? null,
        cooldownSeconds: input.cooldownSeconds ?? null,
      });

      await Q.admin.log.action.logAction({
        ...auditActor(ctx),
        actionType: "player_prompt_create",
        description: `Created player prompt "${input.question.slice(0, 80)}"`,
        metadata: {
          promptId: prompt.id,
          entryMode: input.entryMode,
          maxEntries: input.maxEntries ?? null,
          cooldownSeconds: input.cooldownSeconds ?? null,
        },
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
        ...auditActor(ctx),
        actionType: "player_prompt_close",
        description: `Manually closed player prompt #${input.id}`,
        metadata: { promptId: input.id },
      });

      return { ok: true };
    }),

  delete: adminProcedure
    .meta({
      description:
        "Delete a prompt along with its responses and its Discord announcement.",
    })
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const service = getServiceSync(Services.PLAYER_PROMPT_SERVICE);
      const totals = await Q.player.prompt.response.countByPrompt(input.id);
      const prompt = await service.deletePrompt(input.id);
      if (!prompt) throw trpcError.notFound("Prompt not found");

      await Q.admin.log.action.logAction({
        ...auditActor(ctx),
        actionType: "player_prompt_delete",
        description: `Deleted player prompt "${prompt.question.slice(0, 80)}" with ${totals.entryCount} ${totals.entryCount === 1 ? "entry" : "entries"} from ${totals.responderCount} ${totals.responderCount === 1 ? "responder" : "responders"}`,
        metadata: {
          promptId: input.id,
          question: prompt.question,
          status: prompt.status,
          entryCount: totals.entryCount,
          responderCount: totals.responderCount,
        },
      });

      return { ok: true };
    }),
});
