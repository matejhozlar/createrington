import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import { paginationInput, buildPagination, trpcError } from "@/trpc/utils";
import { getServiceSync, Services } from "@/services";
import { DiscordMessageService } from "@/services/discord/message/message.service";
import { EmbedBuilder } from "discord.js";
import config from "@/config";
import {
  embedDataSchema,
  embedBotSchema,
  type EmbedData,
} from "@createrington/shared/api/embed";

function getMessageService(bot: "main" | "web" = "main") {
  const serviceKey =
    bot === "main" ? Services.DISCORD_MAIN_BOT : Services.DISCORD_WEB_BOT;
  const client = getServiceSync(serviceKey);
  return DiscordMessageService.getInstance(client);
}

function buildDiscordEmbed(data: EmbedData): EmbedBuilder {
  const embed = new EmbedBuilder();

  if (data.title) embed.setTitle(data.title);
  if (data.description) embed.setDescription(data.description);
  if (data.color !== undefined) embed.setColor(data.color);
  if (data.url) embed.setURL(data.url);
  if (data.footer) embed.setFooter({ text: data.footer });
  if (data.author) {
    embed.setAuthor({
      name: data.author,
      url: data.authorUrl || undefined,
      iconURL: data.authorIconUrl || undefined,
    });
  }
  if (data.thumbnailUrl) embed.setThumbnail(data.thumbnailUrl);
  if (data.imageUrl) embed.setImage(data.imageUrl);
  if (data.timestamp) embed.setTimestamp();
  if (data.fields.length > 0) {
    embed.addFields(
      data.fields.map((f) => ({
        name: f.name,
        value: f.value,
        inline: f.inline,
      })),
    );
  }

  return embed;
}

const channels = config.discord.guild.channels;
const categories = config.discord.guild.categories;
const colors = config.discord.embeds.colors;

/** Admin embeds router — send Discord embeds, manage embed presets (CRUD). */
export const embedsRouter = router({
  channels: adminProcedure
    .meta({ description: "Get all text channels grouped by category." })
    .query(() => {
      const grouped: Array<{
        category: string;
        categoryId: string;
        channels: Array<{ name: string; id: string }>;
      }> = [];

      for (const [categoryKey, channelMap] of Object.entries(channels)) {
        const categoryId =
          (categories as unknown as Record<string, string>)[categoryKey] ?? "";
        const channelList: Array<{ name: string; id: string }> = [];

        for (const [channelName, channelId] of Object.entries(
          channelMap as Record<string, string>,
        )) {
          channelList.push({ name: channelName, id: channelId });
        }

        grouped.push({
          category: categoryKey,
          categoryId,
          channels: channelList,
        });
      }

      return grouped;
    }),

  colors: adminProcedure
    .meta({ description: "Get all available embed colors." })
    .query(() => {
      return Object.entries(colors).map(([name, value]) => ({
        name,
        value: value as number,
        hex: `#${(value as number).toString(16).padStart(6, "0")}`,
      }));
    }),

  send: adminProcedure
    .meta({ description: "Send an embed to a Discord channel." })
    .input(
      z.object({
        channelId: z.string().min(1),
        embed: embedDataSchema,
        presetId: z.number().int().positive().optional(),
        bot: embedBotSchema.default("main"),
      }),
    )
    .mutation(async ({ input }) => {
      const { channelId } = input;
      const data = input.embed as EmbedData;

      if (!data.title && !data.description && data.fields.length === 0) {
        throw trpcError.badRequest(
          "Embed must have at least a title, description, or one field.",
        );
      }

      const embed = buildDiscordEmbed(data);
      const messageService = getMessageService(input.bot);

      const result = await messageService.send({
        channelId,
        embeds: embed,
      });

      if (!result.success) {
        throw trpcError.internal(result.error ?? "Failed to send embed");
      }

      if (input.presetId && result.messageId) {
        await Q.discord.embed.preset.message.create({
          presetId: input.presetId,
          channelId: input.channelId,
          messageId: result.messageId,
        });
      }

      return { messageId: result.messageId };
    }),

  edit: adminProcedure
    .meta({ description: "Edit an existing embed message." })
    .input(
      z.object({
        channelId: z.string().min(1),
        messageId: z.string().min(1),
        embed: embedDataSchema,
        presetId: z.number().int().positive().optional(),
        bot: embedBotSchema.default("main"),
      }),
    )
    .mutation(async ({ input }) => {
      const { channelId, messageId } = input;
      const data = input.embed as EmbedData;

      if (!data.title && !data.description && data.fields.length === 0) {
        throw trpcError.badRequest(
          "Embed must have at least a title, description, or one field.",
        );
      }

      const embed = buildDiscordEmbed(data);
      const messageService = getMessageService(input.bot);

      const result = await messageService.edit({
        channelId,
        messageId,
        embeds: embed,
      });

      if (!result.success) {
        throw trpcError.internal(result.error ?? "Failed to edit embed");
      }

      if (input.presetId) {
        await Q.discord.embed.preset.update(
          { id: input.presetId },
          { data: input.embed as EmbedData as Record<string, unknown> },
        );
      }

      return { messageId: result.messageId };
    }),

  updateAll: adminProcedure
    .meta({
      description:
        "Update a preset and all its linked messages at once.",
    })
    .input(
      z.object({
        presetId: z.number().int().positive(),
        embed: embedDataSchema,
        bot: embedBotSchema.default("main"),
      }),
    )
    .mutation(async ({ input }) => {
      const data = input.embed as EmbedData;

      if (!data.title && !data.description && data.fields.length === 0) {
        throw trpcError.badRequest(
          "Embed must have at least a title, description, or one field.",
        );
      }

      await Q.discord.embed.preset.update(
        { id: input.presetId },
        { data: data as Record<string, unknown> },
      );

      const links = await Q.discord.embed.preset.message
        .where({ presetId: input.presetId })
        .all();

      const embed = buildDiscordEmbed(data);
      const messageService = getMessageService(input.bot);

      let updated = 0;
      const errors: string[] = [];

      for (const link of links) {
        const result = await messageService.edit({
          channelId: link.channelId,
          messageId: link.messageId,
          embeds: embed,
        });

        if (result.success) {
          updated++;
        } else {
          errors.push(
            `${link.messageId}: ${result.error ?? "Unknown error"}`,
          );
        }
      }

      return { updated, failed: errors.length, errors };
    }),

  updateLink: adminProcedure
    .meta({ description: "Update a single linked message with current embed data." })
    .input(
      z.object({
        linkId: z.number().int().positive(),
        embed: embedDataSchema,
        bot: embedBotSchema.default("main"),
      }),
    )
    .mutation(async ({ input }) => {
      const data = input.embed as EmbedData;

      if (!data.title && !data.description && data.fields.length === 0) {
        throw trpcError.badRequest(
          "Embed must have at least a title, description, or one field.",
        );
      }

      const link = await Q.discord.embed.preset.message.find({
        id: input.linkId,
      });
      if (!link) {
        throw trpcError.notFound("Link not found");
      }

      const embed = buildDiscordEmbed(data);
      const messageService = getMessageService(input.bot);

      const result = await messageService.edit({
        channelId: link.channelId,
        messageId: link.messageId,
        embeds: embed,
      });

      if (!result.success) {
        throw trpcError.internal(
          result.error ?? "Failed to update linked message",
        );
      }

      return { messageId: result.messageId };
    }),

  fetchMessage: adminProcedure
    .meta({ description: "Fetch an embed message from a channel." })
    .input(
      z.object({
        channelId: z.string().min(1),
        messageId: z.string().min(1),
        bot: embedBotSchema.default("main"),
      }),
    )
    .query(async ({ input }) => {
      const messageService = getMessageService(input.bot);

      const result = await messageService.fetchMessage({
        channelId: input.channelId,
        messageId: input.messageId,
      });

      if (!result.success) {
        throw trpcError.notFound(result.error);
      }

      const embed = result.message.embeds[0];
      if (!embed) {
        throw trpcError.notFound("Message has no embeds");
      }

      return {
        title: embed.title ?? undefined,
        description: embed.description ?? undefined,
        color: embed.color ?? undefined,
        url: embed.url ?? undefined,
        footer: embed.footer?.text ?? undefined,
        author: embed.author?.name ?? undefined,
        authorUrl: embed.author?.url ?? undefined,
        authorIconUrl: embed.author?.iconURL ?? undefined,
        thumbnailUrl: embed.thumbnail?.url ?? undefined,
        imageUrl: embed.image?.url ?? undefined,
        timestamp: !!embed.timestamp,
        fields: embed.fields.map((f) => ({
          name: f.name,
          value: f.value,
          inline: f.inline ?? false,
        })),
      };
    }),

  presets: router({
    list: adminProcedure
      .meta({ description: "List embed presets with optional search or category filter." })
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
          query = query.where({ name: { $ilike: `%${input.search}%` } });
          countQuery = countQuery.where({ name: { $ilike: `%${input.search}%` } });
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
      .meta({ description: "Get a single embed preset." })
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        const preset = await Q.discord.embed.preset.find({ id: input.id });

        if (!preset) {
          throw trpcError.notFound("Preset not found");
        }

        return { preset };
      }),

    create: adminProcedure
      .meta({ description: "Create a new embed preset." })
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

        await Q.discord.embed.preset.create({
          name: input.name,
          data: input.data as EmbedData as Record<string, unknown>,
          createdBy: ctx.user.minecraftUsername,
          categoryId: input.categoryId ?? undefined,
        });

        return { message: "Preset created" };
      }),

    update: adminProcedure
      .meta({ description: "Update an existing embed preset." })
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
      .meta({ description: "Delete an embed preset." })
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
      .meta({ description: "Move a preset into a category (or uncategorized)." })
      .input(
        z.object({
          presetId: z.number().int().positive(),
          categoryId: z.number().int().positive().nullable(),
        }),
      )
      .mutation(async ({ input }) => {
        const preset = await Q.discord.embed.preset.find({ id: input.presetId });
        if (!preset) {
          throw trpcError.notFound("Preset not found");
        }

        await Q.discord.embed.preset.update(
          { id: input.presetId },
          { categoryId: input.categoryId },
        );

        return { message: "Preset category updated" };
      }),

    categories: router({
      list: adminProcedure
        .meta({ description: "List all preset categories with preset counts." })
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
        .meta({ description: "Create a new preset category." })
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

          await Q.discord.embed.preset.category.create({
            name: input.name,
            sortOrder: nextSort,
          });

          return { message: "Category created" };
        }),

      update: adminProcedure
        .meta({ description: "Update a preset category." })
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
        .meta({ description: "Delete a preset category (presets become uncategorized)." })
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
    }),

    links: router({
      list: adminProcedure
        .meta({ description: "List linked messages for a preset." })
        .input(z.object({ presetId: z.number().int().positive() }))
        .query(async ({ input }) => {
          const links = await Q.discord.embed.preset.message
            .where({ presetId: input.presetId })
            .orderBy("createdAt", "desc")
            .all();
          return { links };
        }),

      delete: adminProcedure
        .meta({ description: "Unlink a message from a preset." })
        .input(z.object({ id: z.number().int().positive() }))
        .mutation(async ({ input }) => {
          const link = await Q.discord.embed.preset.message.find({
            id: input.id,
          });
          if (!link) {
            throw trpcError.notFound("Link not found");
          }

          await Q.discord.embed.preset.message.delete({ id: input.id });

          return { message: "Link removed" };
        }),
    }),
  }),
});
