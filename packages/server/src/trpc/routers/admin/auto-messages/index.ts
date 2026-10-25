import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { Q, db } from "@/db";
import { findOrThrow, auditActor, assertPatchNotEmpty } from "@/trpc/utils";
import { getServiceSync, Services } from "@/services";
import config from "@/config";

const MAX_FOLLOWUPS_PER_MESSAGE = 5;

const followupInputSchema = z.object({
  content: z.string().min(1).max(2000),
  delaySeconds: z.number().int().min(1).max(3600),
  enabled: z.boolean().default(true),
});

/** Helper to log auto-message admin actions */
async function logAutoMessageAction(
  ctx: { user: { discordId: string; minecraftUsername: string } },
  actionType: string,
  description: string,
  metadata?: Record<string, unknown>,
) {
  await Q.admin.log.action.logAction({
    ...auditActor(ctx),
    actionType,
    description,
    metadata,
  });
}

/** Admin auto-messages router: channel listing, config CRUD, and message management (add/update/delete/reorder). */
export const autoMessagesRouter = router({
  channels: adminProcedure
    .meta({ description: "Get all text channels grouped by category" })
    .query(() => {
      const channels = config.discord.guild.channels;
      const categories = config.discord.guild.categories;
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
      .meta({ description: "List all auto-message configs" })
      .query(async () => {
        const [configs, messageCounts] = await Promise.all([
          Q.discord.auto.message.config.getAll({
            orderBy: "createdAt",
            orderDirection: "desc",
          }),
          Q.discord.auto.message.countBy("configId"),
        ]);

        return configs.map((c) => ({
          ...c,
          messageCount: messageCounts.get(c.id) ?? 0,
        }));
      }),

    get: adminProcedure
      .meta({ description: "Get a single auto-message config with messages" })
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        const config = await findOrThrow(
          Q.discord.auto.message.config.find({ id: input.id }),
          "Config not found",
        );

        const messages = await Q.discord.auto.message
          .where({ configId: config.id })
          .orderBy("sortOrder", "asc")
          .all();

        const followups =
          messages.length > 0
            ? await Q.discord.auto.message.followup.findAll(
                { messageId: { $in: messages.map((m) => m.id) } },
                { orderBy: "sortOrder", orderDirection: "asc" },
              )
            : [];
        const followupsByMessage = new Map<number, typeof followups>();
        for (const followup of followups) {
          const list = followupsByMessage.get(followup.messageId) ?? [];
          list.push(followup);
          followupsByMessage.set(followup.messageId, list);
        }

        return {
          ...config,
          messages: messages.map((m) => ({
            ...m,
            followups: followupsByMessage.get(m.id) ?? [],
          })),
        };
      }),

    create: adminProcedure
      .meta({ description: "Create a new auto-message config" })
      .input(
        z.object({
          name: z.string().min(1).max(100),
          channelId: z.string().min(1),
          enabled: z.boolean().default(false),
          intervalMinutes: z.number().int().min(1).max(10080).default(60),
          rotationMode: z.enum(["sequential", "random"]).default("sequential"),
        }),
      )
      .mutation(async ({ input, ctx }) => {
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

        await logAutoMessageAction(
          ctx,
          "auto_message_config_create",
          `Created auto-message config "${input.name}"`,
        );

        return created;
      }),

    update: adminProcedure
      .meta({ description: "Update an auto-message config" })
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
      .mutation(async ({ input, ctx }) => {
        const existing = await findOrThrow(
          Q.discord.auto.message.config.find({ id: input.id }),
          "Config not found",
        );

        const { id, ...updates } = input;
        assertPatchNotEmpty(updates);
        await Q.discord.auto.message.config.update({ id }, updates);

        const service = getServiceSync(Services.AUTO_MESSAGE_SERVICE);
        await service.restartConfig(id);

        await logAutoMessageAction(
          ctx,
          "auto_message_config_update",
          `Updated auto-message config "${existing.name}"`,
        );

        return { message: "Config updated" };
      }),

    delete: adminProcedure
      .meta({ description: "Delete an auto-message config" })
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        const existing = await findOrThrow(
          Q.discord.auto.message.config.find({ id: input.id }),
          "Config not found",
        );

        const service = getServiceSync(Services.AUTO_MESSAGE_SERVICE);
        service.stopConfig(input.id);

        await Q.discord.auto.message.config.delete({ id: input.id });

        await logAutoMessageAction(
          ctx,
          "auto_message_config_delete",
          `Deleted auto-message config "${existing.name}"`,
        );

        return { message: "Config deleted" };
      }),
  }),

  messages: router({
    create: adminProcedure
      .meta({ description: "Add a message to a config" })
      .input(
        z.object({
          configId: z.number().int().positive(),
          content: z.string().min(1).max(2000),
          sortOrder: z.number().int().default(0),
          enabled: z.boolean().default(true),
          followups: z
            .array(followupInputSchema)
            .max(MAX_FOLLOWUPS_PER_MESSAGE)
            .default([]),
        }),
      )
      .mutation(async ({ input }) => {
        await findOrThrow(
          Q.discord.auto.message.config.find({ id: input.configId }),
          "Config not found",
        );

        return await db.inTransaction(async (tx) => {
          const created = await tx.discord.auto.message.createAndReturn({
            configId: input.configId,
            content: input.content,
            sortOrder: input.sortOrder,
            enabled: input.enabled,
          });

          for (let i = 0; i < input.followups.length; i++) {
            const f = input.followups[i];
            await tx.discord.auto.message.followup.create({
              messageId: created.id,
              content: f.content,
              delaySeconds: f.delaySeconds,
              enabled: f.enabled,
              sortOrder: i,
            });
          }

          return created;
        });
      }),

    update: adminProcedure
      .meta({ description: "Update a message" })
      .input(
        z.object({
          id: z.number().int().positive(),
          content: z.string().min(1).max(2000).optional(),
          sortOrder: z.number().int().optional(),
          enabled: z.boolean().optional(),
          followups: z
            .array(followupInputSchema)
            .max(MAX_FOLLOWUPS_PER_MESSAGE)
            .optional(),
        }),
      )
      .mutation(async ({ input }) => {
        await findOrThrow(
          Q.discord.auto.message.find({ id: input.id }),
          "Message not found",
        );

        const { id, followups, ...updates } = input;

        await db.inTransaction(async (tx) => {
          if (Object.keys(updates).length > 0) {
            await tx.discord.auto.message.update({ id }, updates);
          }

          if (followups !== undefined) {
            await tx.discord.auto.message.followup.deleteAll({
              messageId: id,
            });

            for (let i = 0; i < followups.length; i++) {
              const f = followups[i];
              await tx.discord.auto.message.followup.create({
                messageId: id,
                content: f.content,
                delaySeconds: f.delaySeconds,
                enabled: f.enabled,
                sortOrder: i,
              });
            }
          }
        });

        return { message: "Message updated" };
      }),

    delete: adminProcedure
      .meta({ description: "Delete a message" })
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await findOrThrow(
          Q.discord.auto.message.find({ id: input.id }),
          "Message not found",
        );

        await Q.discord.auto.message.delete({ id: input.id });

        return { message: "Message deleted" };
      }),

    reorder: adminProcedure
      .meta({ description: "Bulk update sort order for messages" })
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
        await Q.discord.auto.message.reorder(input.items);

        return { message: "Messages reordered" };
      }),
  }),
});
