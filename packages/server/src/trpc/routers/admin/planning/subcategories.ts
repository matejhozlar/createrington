import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { Q, planningRepo } from "@/db";
import { UniqueViolationError } from "@/db/utils/errors";
import { findOrThrow, id, trpcError } from "@/trpc/utils";
import {
  PLANNING_CATEGORIES,
  PLANNING_SUBCATEGORY_NAME_MAX_LENGTH,
} from "@createrington/shared/planning";

const name = z.string().trim().min(1).max(PLANNING_SUBCATEGORY_NAME_MAX_LENGTH);

function rethrowDuplicate(error: unknown): never {
  if (error instanceof UniqueViolationError) {
    throw trpcError.conflict(
      "This category already has a subcategory with that name",
    );
  }
  throw error;
}

export const planningSubcategoriesRouter = router({
  list: adminProcedure
    .meta({ description: "List planning subcategories in display order" })
    .query(async () => {
      const subcategories = await Q.planning.subcategory.findAll(
        {},
        {
          orderBy: [
            { field: "position", direction: "asc" },
            { field: "name", direction: "asc" },
          ],
        },
      );

      return {
        subcategories: subcategories.map((subcategory) => ({
          id: subcategory.id,
          category: subcategory.category,
          name: subcategory.name,
        })),
      };
    }),

  create: adminProcedure
    .meta({
      description: "Add a subcategory at the end of a planning category",
    })
    .input(z.object({ category: z.enum(PLANNING_CATEGORIES), name }))
    .mutation(async ({ input }) => {
      const siblings = await Q.planning.subcategory.findAll({
        category: input.category,
      });
      const position =
        Math.max(-1, ...siblings.map((sibling) => sibling.position)) + 1;

      const created = await Q.planning.subcategory
        .createAndReturn({ ...input, position })
        .catch(rethrowDuplicate);

      return { id: created.id };
    }),

  update: adminProcedure
    .meta({ description: "Rename a planning subcategory" })
    .input(z.object({ id: id(), name }))
    .mutation(async ({ input }) => {
      await findOrThrow(
        Q.planning.subcategory.find({ id: input.id }),
        "Subcategory not found",
      );
      await Q.planning.subcategory
        .update({ id: input.id }, { name: input.name })
        .catch(rethrowDuplicate);

      return { message: "Subcategory renamed" };
    }),

  delete: adminProcedure
    .meta({
      description:
        "Delete a planning subcategory; its items stay in the category without one, each with a new revision",
    })
    .input(z.object({ id: id() }))
    .mutation(async ({ input, ctx }) => {
      await findOrThrow(
        Q.planning.subcategory.find({ id: input.id }),
        "Subcategory not found",
      );
      await planningRepo.deleteSubcategory(input.id, ctx.user.discordId);

      return { message: "Subcategory deleted" };
    }),
});
