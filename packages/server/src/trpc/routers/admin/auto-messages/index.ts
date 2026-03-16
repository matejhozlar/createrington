import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import { trpcError } from "@/trpc/utils";
import { getServiceSync, Services } from "@/services";
import config from "@/config";

const channels = config.discord.guild.channels;
const categories = config.discord.guild.categories;

export const autoMessagesRouter = router({
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

  configs: router({
    list: adminProcedure
      .meta({ description: "List all auto-message configs." })
      .query(async () => {
        const configs = await Q.discord.auto.message.config
          .where({})
          .orderBy("createdAt", "desc")
          .all();

        const configsWithCount = await Promise.all(
          configs.map(async (c) => {
            const messageCount = await Q.discord.auto.message
              .where({ configId: c.id })
              .count();
            return { ...c, messageCount };
          }),
        );

        return configsWithCount;
      }),

    get: adminProcedure
      .meta({ description: "Get a single auto-message config with messages." })
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        const config = await Q.discord.auto.message.config.find({
          id: input.id,
        });
        if (!config) throw trpcError.notFound("Config not found");

        const messages = await Q.discord.auto.message
          .where({ configId: config.id })
          .orderBy("sortOrder", "asc")
          .all();

        return { ...config, messages };
      }),

    create: adminProcedure
      .meta({ description: "Create a new auto-message config." })
      .input(
        z.object({
          name: z.string().min(1).max(100),
          channelId: z.string().min(1),
          enabled: z.boolean().default(false),
          intervalMinutes: z.number().int().min(1).max(10080).default(60),
          rotationMode: z.enum(["sequential", "random"]).default("sequential"),
        }),
      )
      .mutation(async ({ input }) => {
        const created = await Q.discord.auto.message.config.createAndReturn({
          name: input.name,
          channelId: input.channelId,
          enabled: input.enabled,
          intervalMinutes: input.intervalMinutes,
          rotationMode: input.rotationMode,
        });

        if (input.enabled) {
          const service = getServiceSync(Services.AUTO_MESSAGE_SERVICE);
          await service.startConfig(created.id);
        }

        return created;
      }),

    update: adminProcedure
      .meta({ description: "Update an auto-message config." })
      .input(
        z.object({
          id: z.number().int().positive(),
          name: z.string().min(1).max(100).optional(),
          channelId: z.string().min(1).optional(),
          enabled: z.boolean().optional(),
          intervalMinutes: z.number().int().min(1).max(10080).optional(),
          rotationMode: z.enum(["sequential", "random"]).optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const existing = await Q.discord.auto.message.config.find({
          id: input.id,
        });
        if (!existing) throw trpcError.notFound("Config not found");

        const { id, ...updates } = input;
        await Q.discord.auto.message.config.update({ id }, updates);

        const service = getServiceSync(Services.AUTO_MESSAGE_SERVICE);
        await service.restartConfig(id);

        return { message: "Config updated" };
      }),

    delete: adminProcedure
      .meta({ description: "Delete an auto-message config." })
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        const existing = await Q.discord.auto.message.config.find({
          id: input.id,
        });
        if (!existing) throw trpcError.notFound("Config not found");

        const service = getServiceSync(Services.AUTO_MESSAGE_SERVICE);
        service.stopConfig(input.id);

        await Q.discord.auto.message.config.delete({ id: input.id });

        return { message: "Config deleted" };
      }),
  }),

  messages: router({
    create: adminProcedure
      .meta({ description: "Add a message to a config." })
      .input(
        z.object({
          configId: z.number().int().positive(),
          content: z.string().min(1).max(2000),
          sortOrder: z.number().int().default(0),
          enabled: z.boolean().default(true),
        }),
      )
      .mutation(async ({ input }) => {
        const config = await Q.discord.auto.message.config.find({
          id: input.configId,
        });
        if (!config) throw trpcError.notFound("Config not found");

        const created = await Q.discord.auto.message.createAndReturn({
          configId: input.configId,
          content: input.content,
          sortOrder: input.sortOrder,
          enabled: input.enabled,
        });

        return created;
      }),

    update: adminProcedure
      .meta({ description: "Update a message." })
      .input(
        z.object({
          id: z.number().int().positive(),
          content: z.string().min(1).max(2000).optional(),
          sortOrder: z.number().int().optional(),
          enabled: z.boolean().optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const existing = await Q.discord.auto.message.find({ id: input.id });
        if (!existing) throw trpcError.notFound("Message not found");

        const { id, ...updates } = input;
        await Q.discord.auto.message.update({ id }, updates);

        return { message: "Message updated" };
      }),

    delete: adminProcedure
      .meta({ description: "Delete a message." })
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        const existing = await Q.discord.auto.message.find({ id: input.id });
        if (!existing) throw trpcError.notFound("Message not found");

        await Q.discord.auto.message.delete({ id: input.id });

        return { message: "Message deleted" };
      }),

    reorder: adminProcedure
      .meta({ description: "Bulk update sort order for messages." })
      .input(
        z.object({
          items: z.array(
            z.object({
              id: z.number().int().positive(),
              sortOrder: z.number().int(),
            }),
          ),
        }),
      )
      .mutation(async ({ input }) => {
        await Promise.all(
          input.items.map((item) =>
            Q.discord.auto.message.update(
              { id: item.id },
              { sortOrder: item.sortOrder },
            ),
          ),
        );

        return { message: "Messages reordered" };
      }),
  }),
});
