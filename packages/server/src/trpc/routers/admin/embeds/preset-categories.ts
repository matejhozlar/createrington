import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import { trpcError } from "@/trpc/utils";

export const embedPresetCategoriesRouter = router({
  list: adminProcedure
    .meta({ description: "List all preset categories with preset counts" })
    .query(async () => {
      const cats = await Q.discord.embed.preset.category
        .where({})
        .orderBy("sortOrder", "asc")
        .all();

      const counts = await Promise.all(
        cats.map((cat) =>
          Q.discord.embed.preset.where({ categoryId: cat.id }).count(),
        ),
      );

      return cats.map((cat, i) => ({
        ...cat,
        presetCount: counts[i],
      }));
    }),

  create: adminProcedure
    .meta({ description: "Create a new preset category" })
    .input(z.object({ name: z.string().min(1).max(100) }))
    .mutation(async ({ input }) => {
      const existing = await Q.discord.embed.preset.category.find({
        name: input.name,
      });
      if (existing) {
        throw trpcError.conflict("A category with that name already exists");
      }

      const maxSort = await Q.discord.embed.preset.category
        .where({})
        .orderBy("sortOrder", "desc")
        .limit(1)
        .all();
      const nextSort = maxSort.length > 0 ? maxSort[0].sortOrder + 1 : 0;

      const created = await Q.discord.embed.preset.category.createAndReturn({
        name: input.name,
        sortOrder: nextSort,
      });

      return { id: created.id, name: created.name };
    }),

  update: adminProcedure
    .meta({ description: "Update a preset category" })
    .input(
      z.object({
        id: z.number().int().positive(),
        name: z.string().min(1).max(100).optional(),
        sortOrder: z.number().int().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const existing = await Q.discord.embed.preset.category.find({
        id: input.id,
      });
      if (!existing) {
        throw trpcError.notFound("Category not found");
      }

      if (input.name && input.name !== existing.name) {
        const nameConflict = await Q.discord.embed.preset.category.find({
          name: input.name,
        });
        if (nameConflict) {
          throw trpcError.conflict("A category with that name already exists");
        }
      }

      const updates: Record<string, unknown> = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;

      await Q.discord.embed.preset.category.update({ id: input.id }, updates);

      return { message: "Category updated" };
    }),

  delete: adminProcedure
    .meta({
      description: "Delete a preset category (presets become uncategorized)",
    })
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const existing = await Q.discord.embed.preset.category.find({
        id: input.id,
      });
      if (!existing) {
        throw trpcError.notFound("Category not found");
      }

      await Q.discord.embed.preset.category.delete({ id: input.id });

      return { message: "Category deleted" };
    }),
});
