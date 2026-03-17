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
  type EmbedData,
} from "@createrington/shared/api/embed";

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

      const webBot = getServiceSync(Services.DISCORD_WEB_BOT);
      const messageService = DiscordMessageService.getInstance(webBot);

      const result = await messageService.send({
        channelId,
        embeds: embed,
      });

      if (!result.success) {
        throw trpcError.internal(result.error ?? "Failed to send embed");
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

      const webBot = getServiceSync(Services.DISCORD_WEB_BOT);
      const messageService = DiscordMessageService.getInstance(webBot);

      const result = await messageService.edit({
        channelId,
        messageId,
        embeds: embed,
      });

      if (!result.success) {
        throw trpcError.internal(result.error ?? "Failed to edit embed");
      }

      return { messageId: result.messageId };
    }),

  fetchMessage: adminProcedure
    .meta({ description: "Fetch an embed message from a channel." })
    .input(
      z.object({
        channelId: z.string().min(1),
        messageId: z.string().min(1),
      }),
    )
    .query(async ({ input }) => {
      const webBot = getServiceSync(Services.DISCORD_WEB_BOT);
      const messageService = DiscordMessageService.getInstance(webBot);

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
      .meta({ description: "List embed presets with search." })
      .input(
        z.object({
          search: z.string().optional(),
          ...paginationInput(),
        }),
      )
      .query(async ({ input }) => {
        let query = Q.discord.embed.preset.where({});

        if (input.search) {
          query = query.where({ name: { $ilike: `%${input.search}%` } });
        }

        const countQuery = Q.discord.embed.preset.where({});
        if (input.search) {
          countQuery.where({ name: { $ilike: `%${input.search}%` } });
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
  }),
});
