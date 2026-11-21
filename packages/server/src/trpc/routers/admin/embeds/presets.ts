import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import { ilikeContains } from "@/db/utils";
import {
  paginationInput,
  paginateQuery,
  findOrThrow,
  trpcError,
  assertPatchNotEmpty,
  id,
} from "@/trpc/utils";
import { messagePayloadSchema } from "@createrington/shared/api/embed";
import type { DiscordEmbedPresetFilters } from "@createrington/shared/db";
import { payloadToStorage } from "./helpers";
import { embedPresetCategoriesRouter } from "./preset-categories";
import { embedPresetLinksRouter } from "./preset-links";

export const embedPresetsRouter = router({
  list: adminProcedure
    .meta({
      description: "List embed presets with optional search or category filter",
    })
    .input(
      z.object({
        search: z.string().optional(),
        categoryId: z.union([id(), z.literal("uncategorized")]).optional(),
        ...paginationInput(),
      }),
    )
    .query(async ({ input }) => {
      const filters: DiscordEmbedPresetFilters = {};
      if (input.search) {
        filters.name = ilikeContains(input.search);
      } else if (input.categoryId === "uncategorized") {
        filters.categoryId = { $exists: false };
      } else if (input.categoryId !== undefined) {
        filters.categoryId = input.categoryId;
      }

      const { rows: presets, pagination } = await paginateQuery(
        Q.discord.embed.preset,
        filters,
        input,
        { orderBy: "updatedAt", orderDirection: "desc" },
      );

      return { items: presets, pagination };
    }),

  get: adminProcedure
    .meta({ description: "Get a single embed preset" })
    .input(z.object({ id: id() }))
    .query(async ({ input }) => {
      const preset = await findOrThrow(
        Q.discord.embed.preset.find({ id: input.id }),
        "Preset not found",
      );

      return { preset };
    }),

  create: adminProcedure
    .meta({ description: "Create a new embed or components preset" })
    .input(
      z
        .object({
          name: z.string().min(1).max(100),
          categoryId: id().nullish(),
        })
        .and(messagePayloadSchema),
    )
    .mutation(async ({ input, ctx }) => {
      const existing = await Q.discord.embed.preset.find({
        name: input.name,
      });
      if (existing) {
        throw trpcError.conflict("A preset with that name already exists");
      }

      const { kind, data } = payloadToStorage(input);
      const created = await Q.discord.embed.preset.createAndReturn({
        name: input.name,
        kind,
        data,
        createdBy: ctx.user.minecraftUsername,
        categoryId: input.categoryId ?? undefined,
      });

      return {
        id: created.id,
        name: created.name,
        kind: created.kind,
        categoryId: created.categoryId ?? null,
      };
    }),

  update: adminProcedure
    .meta({ description: "Update an existing preset" })
    .input(
      z.object({
        id: id(),
        name: z.string().min(1).max(100).optional(),
        payload: messagePayloadSchema.optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const existing = await findOrThrow(
        Q.discord.embed.preset.find({ id: input.id }),
        "Preset not found",
      );

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
      if (input.payload) {
        if (input.payload.kind !== existing.kind) {
          throw trpcError.badRequest(
            `Preset is a ${existing.kind} preset and cannot be changed to ${input.payload.kind}`,
          );
        }
        updates.data = payloadToStorage(input.payload).data;
      }

      assertPatchNotEmpty(updates);
      await Q.discord.embed.preset.update({ id: input.id }, updates);
    }),

  delete: adminProcedure
    .meta({ description: "Delete an embed preset" })
    .input(z.object({ id: id() }))
    .mutation(async ({ input }) => {
      await findOrThrow(
        Q.discord.embed.preset.find({ id: input.id }),
        "Preset not found",
      );

      await Q.discord.embed.preset.delete({ id: input.id });
    }),

  setCategory: adminProcedure
    .meta({
      description: "Move a preset into a category (or uncategorized).",
    })
    .input(
      z.object({
        presetId: id(),
        categoryId: id().nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      await findOrThrow(
        Q.discord.embed.preset.find({ id: input.presetId }),
        "Preset not found",
      );

      await Q.discord.embed.preset.update(
        { id: input.presetId },
        { categoryId: input.categoryId },
      );
    }),

  categories: embedPresetCategoriesRouter,

  links: embedPresetLinksRouter,
});
