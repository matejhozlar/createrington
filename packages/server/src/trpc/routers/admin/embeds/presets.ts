import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import { escapeLike } from "@/db/utils";
import { paginationInput, buildPagination, trpcError } from "@/trpc/utils";
import {
  embedDataSchema,
  type EmbedData,
} from "@createrington/shared/api/embed";
import { embedPresetCategoriesRouter } from "./preset-categories";
import { embedPresetLinksRouter } from "./preset-links";

/** Admin embed presets router: preset CRUD, categorisation, and linked-message listing. */
export const embedPresetsRouter = router({
  list: adminProcedure
    .meta({
      description: "List embed presets with optional search or category filter",
    })
    .input(
      z.object({
        search: z.string().optional(),
        categoryId: z
          .union([z.number().int().positive(), z.literal("uncategorized")])
          .optional(),
        ...paginationInput(),
      }),
    )
    .query(async ({ input }) => {
      let query = Q.discord.embed.preset.where({});
      let countQuery = Q.discord.embed.preset.where({});

      if (input.search) {
        query = query.where({
          name: { $ilike: `%${escapeLike(input.search)}%` },
        });
        countQuery = countQuery.where({
          name: { $ilike: `%${escapeLike(input.search)}%` },
        });
      } else if (input.categoryId !== undefined) {
        const filter =
          input.categoryId === "uncategorized"
            ? { categoryId: { $exists: false } }
            : { categoryId: input.categoryId };
        query = query.where(filter);
        countQuery = countQuery.where(filter);
      }

      const [presets, total] = await Promise.all([
        query
          .orderBy("updatedAt", "desc")
          .paginate(input.page, input.limit)
          .all(),
        countQuery.count(),
      ]);

      return {
        presets,
        pagination: buildPagination(input.page, input.limit, total),
      };
    }),

  get: adminProcedure
    .meta({ description: "Get a single embed preset" })
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const preset = await Q.discord.embed.preset.find({ id: input.id });

      if (!preset) {
        throw trpcError.notFound("Preset not found");
      }

      return { preset };
    }),

  create: adminProcedure
    .meta({ description: "Create a new embed preset" })
    .input(
      z.object({
        name: z.string().min(1).max(100),
        data: embedDataSchema,
        categoryId: z.number().int().positive().nullish(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const existing = await Q.discord.embed.preset.find({
        name: input.name,
      });
      if (existing) {
        throw trpcError.conflict("A preset with that name already exists");
      }

      const created = await Q.discord.embed.preset.createAndReturn({
        name: input.name,
        data: input.data as EmbedData as Record<string, unknown>,
        createdBy: ctx.user.minecraftUsername,
        categoryId: input.categoryId ?? undefined,
      });

      return {
        message: "Preset created",
        id: created.id,
        name: created.name,
        categoryId: created.categoryId ?? null,
      };
    }),

  update: adminProcedure
    .meta({ description: "Update an existing embed preset" })
    .input(
      z.object({
        id: z.number().int().positive(),
        name: z.string().min(1).max(100).optional(),
        data: embedDataSchema.optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const existing = await Q.discord.embed.preset.find({ id: input.id });
      if (!existing) {
        throw trpcError.notFound("Preset not found");
      }

      if (input.name && input.name !== existing.name) {
        const nameConflict = await Q.discord.embed.preset.find({
          name: input.name,
        });
        if (nameConflict) {
          throw trpcError.conflict("A preset with that name already exists");
        }
      }

      const updates: Record<string, unknown> = {};
      if (input.name) updates.name = input.name;
      if (input.data) updates.data = input.data;

      await Q.discord.embed.preset.update({ id: input.id }, updates);

      return { message: "Preset updated" };
    }),

  delete: adminProcedure
    .meta({ description: "Delete an embed preset" })
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const existing = await Q.discord.embed.preset.find({ id: input.id });
      if (!existing) {
        throw trpcError.notFound("Preset not found");
      }

      await Q.discord.embed.preset.delete({ id: input.id });

      return { message: "Preset deleted" };
    }),

  setCategory: adminProcedure
    .meta({
      description: "Move a preset into a category (or uncategorized).",
    })
    .input(
      z.object({
        presetId: z.number().int().positive(),
        categoryId: z.number().int().positive().nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      const preset = await Q.discord.embed.preset.find({
        id: input.presetId,
      });
      if (!preset) {
        throw trpcError.notFound("Preset not found");
      }

      await Q.discord.embed.preset.update(
        { id: input.presetId },
        { categoryId: input.categoryId },
      );

      return { message: "Preset category updated" };
    }),

  categories: embedPresetCategoriesRouter,

  links: embedPresetLinksRouter,
});
