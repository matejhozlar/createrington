import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import { ilikeContains } from "@/db/utils";
import {
  paginationInput,
  paginateQuery,
  sortDirection,
  findOrThrow,
  trpcError,
  auditActor,
  assertPatchNotEmpty,
  id,
} from "@/trpc/utils";
import { getServiceSync, Services } from "@/services";
import { FaqService } from "@/services/discord/faq";
import type { FaqEntryFilters } from "@createrington/shared/db";
import { FAQ_MATCH_MODES, type FaqMatchMode } from "@createrington/shared/faq";

const matchModeSchema = z.enum(FAQ_MATCH_MODES).default("keywords");

const MAX_PATTERN_LENGTH = 200;
const NESTED_QUANTIFIER = /\([^()]*[+*][^()]*\)[+*?{]/;
const QUANTIFIED_ALTERNATION = /\([^()]*\|[^()]*\)[+*]/;

function validatePattern(matchMode: FaqMatchMode, pattern: string): void {
  if (pattern.length > MAX_PATTERN_LENGTH) {
    throw trpcError.badRequest(
      `Pattern must be at most ${MAX_PATTERN_LENGTH} characters`,
    );
  }
  if (matchMode === "regex") {
    if (
      NESTED_QUANTIFIER.test(pattern) ||
      QUANTIFIED_ALTERNATION.test(pattern)
    ) {
      throw trpcError.badRequest(
        "Pattern contains nested quantifiers that risk catastrophic backtracking",
      );
    }
    try {
      new RegExp(pattern, "i");
    } catch {
      throw trpcError.badRequest("Invalid regex pattern");
    }
  } else {
    try {
      FaqService.keywordsToRegex(pattern);
    } catch {
      throw trpcError.badRequest(
        "Keywords must contain at least one keyword (comma-separated)",
      );
    }
  }
}

export const faqRouter = router({
  list: adminProcedure
    .meta({ description: "List FAQ entries with filtering and pagination" })
    .input(
      z.object({
        enabled: z.boolean().optional(),
        search: z.string().optional(),
        ...paginationInput(),
        orderBy: z.enum(["priority", "title", "createdAt"]).default("priority"),
        orderDirection: sortDirection().default("desc"),
      }),
    )
    .query(async ({ input }) => {
      const filters: FaqEntryFilters = {};
      if (input.enabled !== undefined) filters.enabled = input.enabled;
      if (input.search) filters.title = ilikeContains(input.search);

      const { rows: entries, pagination } = await paginateQuery(
        Q.faq.entry,
        filters,
        input,
        { orderBy: input.orderBy, orderDirection: input.orderDirection },
      );

      return { items: entries, pagination };
    }),

  get: adminProcedure
    .meta({ description: "Get a single FAQ entry by ID" })
    .input(z.object({ id: id() }))
    .query(async ({ input }) => {
      const entry = await findOrThrow(
        Q.faq.entry.find({ id: input.id }),
        "FAQ entry not found",
      );

      return { entry };
    }),

  create: adminProcedure
    .meta({ description: "Create a new FAQ entry" })
    .input(
      z.object({
        matchMode: matchModeSchema,
        pattern: z.string().min(1),
        title: z.string().min(1).max(100),
        response: z.string().min(1),
        priority: z.number().int().default(0),
        enabled: z.boolean().default(true),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      validatePattern(input.matchMode, input.pattern);

      await Q.faq.entry.create({
        matchMode: input.matchMode,
        pattern: input.pattern,
        title: input.title,
        response: input.response,
        priority: input.priority,
        enabled: input.enabled,
      });

      const faqService = getServiceSync(Services.FAQ_SERVICE);
      await faqService.refreshPatterns();

      await Q.admin.log.action.logAction({
        ...auditActor(ctx),
        actionType: "faq_create",
        description: `Created FAQ entry "${input.title}"`,
      });
    }),

  update: adminProcedure
    .meta({ description: "Update an existing FAQ entry" })
    .input(
      z.object({
        id: id(),
        matchMode: z.enum(FAQ_MATCH_MODES).optional(),
        pattern: z.string().min(1).optional(),
        title: z.string().min(1).max(100).optional(),
        response: z.string().min(1).optional(),
        priority: z.number().int().optional(),
        enabled: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const existing = await findOrThrow(
        Q.faq.entry.find({ id: input.id }),
        "FAQ entry not found",
      );

      const effectiveMode = input.matchMode ?? existing.matchMode;
      const effectivePattern = input.pattern ?? existing.pattern;
      validatePattern(effectiveMode, effectivePattern);

      const { id, ...updates } = input;
      assertPatchNotEmpty(updates);
      await Q.faq.entry.update({ id }, updates);

      const faqService = getServiceSync(Services.FAQ_SERVICE);
      await faqService.refreshPatterns();

      await Q.admin.log.action.logAction({
        ...auditActor(ctx),
        actionType: "faq_update",
        description: `Updated FAQ entry "${existing.title}"`,
      });
    }),

  delete: adminProcedure
    .meta({ description: "Delete a FAQ entry" })
    .input(z.object({ id: id() }))
    .mutation(async ({ input, ctx }) => {
      const existing = await findOrThrow(
        Q.faq.entry.find({ id: input.id }),
        "FAQ entry not found",
      );

      await Q.faq.entry.delete({ id: input.id });

      const faqService = getServiceSync(Services.FAQ_SERVICE);
      await faqService.refreshPatterns();

      await Q.admin.log.action.logAction({
        ...auditActor(ctx),
        actionType: "faq_delete",
        description: `Deleted FAQ entry "${existing.title}"`,
      });
    }),

  repostWelcome: adminProcedure
    .meta({ description: "Manually trigger a welcome message repost" })
    .mutation(async ({ ctx }) => {
      const faqService = getServiceSync(Services.FAQ_SERVICE);
      await faqService.repostWelcomeMessage();

      await Q.admin.log.action.logAction({
        ...auditActor(ctx),
        actionType: "faq_repost_welcome",
        description: "Reposted FAQ welcome message",
      });
    }),
});
