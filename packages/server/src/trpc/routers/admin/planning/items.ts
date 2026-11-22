import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { Q, planningRepo } from "@/db";
import { PLANNING_UNASSIGNED } from "@/db/queries/planning/item";
import {
  assertPatchNotEmpty,
  auditActor,
  buildPagination,
  findOrThrow,
  id,
  pageOffset,
  paginationInput,
  sortDirection,
} from "@/trpc/utils";
import { discordId } from "@/utils/zod-schemas";
import {
  PLANNING_CATEGORIES,
  PLANNING_ITEM_STATUSES,
  planningCommentSchema,
  planningTextSchema,
  planningTitleSchema,
} from "@createrington/shared/planning";
import { byName, loadPeople } from "./people";

const MAX_ASSIGNEES = 20;

const category = z.enum(PLANNING_CATEGORIES);
const status = z.enum(PLANNING_ITEM_STATUSES);
const subcategoryId = id().nullable();
const assigneeIds = z.array(discordId).max(MAX_ASSIGNEES);

export const planningItemsRouter = router({
  list: adminProcedure
    .meta({
      description:
        "List planning items with filtering, sorting and pagination, plus how many items each status holds under the other filters",
    })
    .input(
      z.object({
        status: status.optional(),
        category: category.optional(),
        subcategoryId: id().optional(),
        assignee: z
          .union([discordId, z.literal(PLANNING_UNASSIGNED)])
          .optional(),
        search: z.string().trim().max(100).optional(),
        ...paginationInput({ defaultLimit: 12, maxLimit: 60 }),
        orderBy: z
          .enum(["updatedAt", "createdAt", "title"])
          .default("updatedAt"),
        orderDirection: sortDirection().default("desc"),
      }),
    )
    .query(async ({ input }) => {
      const { page, limit, search, ...filters } = input;
      const {
        rows: items,
        total,
        statusCounts,
      } = await Q.planning.item.listPage({
        ...filters,
        search: search || undefined,
        limit,
        offset: pageOffset(input),
      });

      const itemIds = items.map((item) => item.id);
      const [assignees, commentCounts] =
        itemIds.length > 0
          ? await Promise.all([
              Q.planning.item.assignee.findAll({ itemId: { $in: itemIds } }),
              Q.planning.item.comment.countBy("itemId", {
                itemId: { $in: itemIds },
              }),
            ])
          : [[], new Map<number, number>()];

      const person = await loadPeople([
        ...items.map((item) => item.createdBy),
        ...assignees.map((row) => row.discordId),
      ]);
      const assigneesByItem = new Map<number, typeof assignees>();
      for (const row of assignees) {
        const rows = assigneesByItem.get(row.itemId);
        if (rows) rows.push(row);
        else assigneesByItem.set(row.itemId, [row]);
      }

      return {
        items: items.map((item) => ({
          id: item.id,
          title: item.title,
          body: item.body,
          category: item.category,
          subcategoryId: item.subcategoryId,
          status: item.status,
          revision: item.revision,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          createdBy: person(item.createdBy),
          assignees: (assigneesByItem.get(item.id) ?? [])
            .map((row) => person(row.discordId))
            .sort(byName),
          commentCount: commentCounts.get(item.id) ?? 0,
        })),
        pagination: buildPagination(page, limit, total),
        counts: statusCounts,
      };
    }),

  get: adminProcedure
    .meta({
      description:
        "Get one planning item with its comments and full revision history",
    })
    .input(z.object({ id: id() }))
    .query(async ({ input }) => {
      const item = await findOrThrow(
        Q.planning.item.find({ id: input.id }),
        "Planning item not found",
      );
      const [assignees, comments, revisions] = await Promise.all([
        Q.planning.item.assignee.findAll({ itemId: item.id }),
        Q.planning.item.comment.findAll(
          { itemId: item.id },
          { orderBy: "createdAt", orderDirection: "asc" },
        ),
        Q.planning.item.revision.findAll(
          { itemId: item.id },
          { orderBy: "revision", orderDirection: "desc" },
        ),
      ]);

      const person = await loadPeople([
        item.createdBy,
        item.updatedBy,
        ...assignees.map((row) => row.discordId),
        ...comments.map((comment) => comment.authorDiscordId),
        ...revisions.map((revision) => revision.editedBy),
      ]);

      return {
        item: {
          id: item.id,
          title: item.title,
          body: item.body,
          category: item.category,
          subcategoryId: item.subcategoryId,
          status: item.status,
          revision: item.revision,
          sourceUrl: item.sourceUrl,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          createdBy: person(item.createdBy),
          updatedBy: person(item.updatedBy),
          assignees: assignees.map((row) => person(row.discordId)).sort(byName),
        },
        comments: comments.map((comment) => ({
          id: comment.id,
          body: comment.body,
          sourceUrl: comment.sourceUrl,
          createdAt: comment.createdAt,
          author: person(comment.authorDiscordId),
        })),
        revisions: revisions.map((revision) => ({
          id: revision.id,
          revision: revision.revision,
          title: revision.title,
          body: revision.body,
          category: revision.category,
          subcategoryId: revision.subcategoryId,
          status: revision.status,
          createdAt: revision.createdAt,
          editedBy: person(revision.editedBy),
        })),
      };
    }),

  create: adminProcedure
    .meta({ description: "Create a planning item" })
    .input(
      z.object({
        title: planningTitleSchema,
        body: planningTextSchema.default(null),
        category,
        subcategoryId: subcategoryId.default(null),
        status: status.default("draft"),
        assigneeIds: assigneeIds.default([]),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { assigneeIds: assignees, ...content } = input;
      const item = await planningRepo.createItem(content, ctx.user.discordId, {
        assigneeIds: assignees,
      });

      return { id: item.id };
    }),

  update: adminProcedure
    .meta({
      description:
        "Save changes to a planning item as a new revision; refused when the item changed since `revision`",
    })
    .input(
      z.object({
        id: id(),
        revision: z.number().int().positive(),
        title: planningTitleSchema.optional(),
        body: planningTextSchema.optional(),
        category: category.optional(),
        subcategoryId: subcategoryId.optional(),
        status: status.optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { id: itemId, revision, ...patch } = input;
      assertPatchNotEmpty(patch);
      const item = await planningRepo.updateItem(
        itemId,
        revision,
        patch,
        ctx.user.discordId,
      );

      return { id: item.id, revision: item.revision };
    }),

  restore: adminProcedure
    .meta({
      description:
        "Bring back an earlier revision of a planning item as a new revision",
    })
    .input(
      z.object({
        id: id(),
        revision: z.number().int().positive(),
        revisionId: id(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const item = await planningRepo.restoreItem(
        input.id,
        input.revision,
        input.revisionId,
        ctx.user.discordId,
      );

      return { id: item.id, revision: item.revision };
    }),

  assignees: router({
    set: adminProcedure
      .meta({ description: "Replace the admins assigned to a planning item" })
      .input(z.object({ id: id(), discordIds: assigneeIds }))
      .mutation(async ({ input, ctx }) => {
        await planningRepo.setAssignees(
          input.id,
          input.discordIds,
          ctx.user.discordId,
        );
      }),
  }),

  comments: router({
    create: adminProcedure
      .meta({ description: "Add a comment to a planning item" })
      .input(
        z.object({
          id: id(),
          body: planningCommentSchema,
        }),
      )
      .mutation(async ({ input, ctx }) => {
        await findOrThrow(
          Q.planning.item.find({ id: input.id }),
          "Planning item not found",
        );
        await Q.planning.item.comment.create({
          itemId: input.id,
          authorDiscordId: ctx.user.discordId,
          body: input.body,
        });
      }),
  }),

  delete: adminProcedure
    .meta({
      description: "Delete a planning item with its history and comments",
    })
    .input(z.object({ id: id() }))
    .mutation(async ({ input, ctx }) => {
      const item = await findOrThrow(
        Q.planning.item.find({ id: input.id }),
        "Planning item not found",
      );
      await Q.planning.item.delete({ id: item.id });

      await Q.admin.log.action.logAction({
        ...auditActor(ctx),
        actionType: "planning_item_delete",
        description: `Deleted planning item "${item.title}"`,
      });
    }),
});
