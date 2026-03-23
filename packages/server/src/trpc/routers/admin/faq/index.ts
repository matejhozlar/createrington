import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import { escapeLike } from "@/db/utils";
import { paginationInput, buildPagination, trpcError } from "@/trpc/utils";
import { container, Services } from "@/services/container";
import { FaqService } from "@/services/discord/faq";

const matchModeSchema = z.enum(["keywords", "regex"]).default("keywords");

/** Validates a FAQ match pattern based on its mode (keywords or regex). */
function validatePattern(matchMode: string, pattern: string): void {
  if (matchMode === "regex") {
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

/** Admin FAQ router — CRUD for FAQ entries and welcome message management. */
export const faqRouter = router({
  list: adminProcedure
    .meta({ description: "List FAQ entries with filtering and pagination." })
    .input(
      z.object({
        enabled: z.boolean().optional(),
        search: z.string().optional(),
        ...paginationInput(),
        orderBy: z.enum(["priority", "title", "createdAt"]).default("priority"),
        orderDirection: z.enum(["asc", "desc"]).default("desc"),
      }),
    )
    .query(async ({ input }) => {
      let query = Q.faq.entry.where({});

      if (input.enabled !== undefined) {
        query = query.where({ enabled: input.enabled });
      }

      if (input.search) {
        query = query.where({
          title: { $ilike: `%${escapeLike(input.search)}%` },
        });
      }

      const countQuery = Q.faq.entry.where({});
      if (input.enabled !== undefined) {
        countQuery.where({ enabled: input.enabled });
      }
      if (input.search) {
        countQuery.where({
          title: { $ilike: `%${escapeLike(input.search)}%` },
        });
      }

      const [entries, total] = await Promise.all([
        query
          .orderBy(input.orderBy, input.orderDirection)
          .paginate(input.page, input.limit)
          .all(),
        countQuery.count(),
      ]);

      return {
        entries,
        pagination: buildPagination(input.page, input.limit, total),
      };
    }),

  get: adminProcedure
    .meta({ description: "Get a single FAQ entry by ID." })
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const entry = await Q.faq.entry.find({ id: input.id });

      if (!entry) {
        throw trpcError.notFound("FAQ entry not found");
      }

      return { entry };
    }),

  create: adminProcedure
    .meta({ description: "Create a new FAQ entry." })
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
    .mutation(async ({ input }) => {
      validatePattern(input.matchMode, input.pattern);

      await Q.faq.entry.create({
        matchMode: input.matchMode,
        pattern: input.pattern,
        title: input.title,
        response: input.response,
        priority: input.priority,
        enabled: input.enabled,
      });

      const faqService = container.getSync(Services.FAQ_SERVICE);
      await faqService.refreshPatterns();

      return { message: "FAQ entry created" };
    }),

  update: adminProcedure
    .meta({ description: "Update an existing FAQ entry." })
    .input(
      z.object({
        id: z.number().int().positive(),
        matchMode: z.enum(["keywords", "regex"]).optional(),
        pattern: z.string().min(1).optional(),
        title: z.string().min(1).max(100).optional(),
        response: z.string().min(1).optional(),
        priority: z.number().int().optional(),
        enabled: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const existing = await Q.faq.entry.find({ id: input.id });
      if (!existing) {
        throw trpcError.notFound("FAQ entry not found");
      }

      const effectiveMode = input.matchMode ?? existing.matchMode;
      const effectivePattern = input.pattern ?? existing.pattern;
      validatePattern(effectiveMode, effectivePattern);

      const { id, ...updates } = input;
      await Q.faq.entry.update({ id }, updates);

      const faqService = container.getSync(Services.FAQ_SERVICE);
      await faqService.refreshPatterns();

      return { message: "FAQ entry updated" };
    }),

  delete: adminProcedure
    .meta({ description: "Delete a FAQ entry." })
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const existing = await Q.faq.entry.find({ id: input.id });
      if (!existing) {
        throw trpcError.notFound("FAQ entry not found");
      }

      await Q.faq.entry.delete({ id: input.id });

      const faqService = container.getSync(Services.FAQ_SERVICE);
      await faqService.refreshPatterns();

      return { message: "FAQ entry deleted" };
    }),

  repostWelcome: adminProcedure
    .meta({ description: "Manually trigger a welcome message repost." })
    .mutation(async () => {
      const faqService = container.getSync(Services.FAQ_SERVICE);
      await faqService.repostWelcomeMessage();

      return { message: "Welcome message reposted" };
    }),
});
