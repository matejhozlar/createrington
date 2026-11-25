import { z } from "zod";
import { guildChannelsProcedure } from "../guild-channels";
import { router, adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import { findOrThrow, assertPatchNotEmpty, trpcError, id } from "@/trpc/utils";
import { getServiceSync, Services } from "@/services";

const MAX_FOLLOWUPS_PER_MESSAGE = 5;

const followupInputSchema = z.object({
  content: z.string().min(1).max(2000),
  delaySeconds: z.number().int().min(1).max(3600),
  enabled: z.boolean().default(true),
});

export const autoMessagesRouter = router({
  channels: guildChannelsProcedure,

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
      .input(z.object({ id: id() }))
      .query(async ({ input }) => {
        const config = await findOrThrow(
          Q.discord.auto.message.config.find({ id: input.id }),
          "Config not found",
        );

        const messages = await Q.discord.auto.message
          .where({ configId: config.id })
          .orderBy([{ field: "sortOrder" }, { field: "id" }])
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
      .mutation(async ({ input, ctx }) =>
        getServiceSync(Services.AUTO_MESSAGE_SERVICE).createConfig(
          input,
          ctx.user,
        ),
      ),

    update: adminProcedure
      .meta({ description: "Update an auto-message config" })
      .input(
        z.object({
          id: id(),
          name: z.string().min(1).max(100).optional(),
          channelId: z.string().min(1).optional(),
          enabled: z.boolean().optional(),
          intervalMinutes: z.number().int().min(1).max(10080).optional(),
          rotationMode: z.enum(["sequential", "random"]).optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        const { id, ...patch } = input;
        assertPatchNotEmpty(patch);
        await getServiceSync(Services.AUTO_MESSAGE_SERVICE).updateConfig(
          id,
          patch,
          ctx.user,
        );
      }),

    delete: adminProcedure
      .meta({ description: "Delete an auto-message config" })
      .input(z.object({ id: id() }))
      .mutation(async ({ input, ctx }) => {
        await getServiceSync(Services.AUTO_MESSAGE_SERVICE).deleteConfig(
          input.id,
          ctx.user,
        );
      }),
  }),

  messages: router({
    create: adminProcedure
      .meta({ description: "Add a message to a config" })
      .input(
        z.object({
          configId: id(),
          content: z.string().min(1).max(2000),
          sortOrder: z.number().int().optional(),
          enabled: z.boolean().default(true),
          followups: z
            .array(followupInputSchema)
            .max(MAX_FOLLOWUPS_PER_MESSAGE)
            .default([]),
        }),
      )
      .mutation(({ input }) => {
        const { configId, followups, ...fields } = input;
        return getServiceSync(Services.AUTO_MESSAGE_SERVICE).createMessage(
          configId,
          fields,
          followups,
        );
      }),

    update: adminProcedure
      .meta({ description: "Update a message" })
      .input(
        z.object({
          id: id(),
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
        const { id, followups, ...patch } = input;
        await getServiceSync(Services.AUTO_MESSAGE_SERVICE).updateMessage(
          id,
          patch,
          followups,
        );
      }),

    delete: adminProcedure
      .meta({ description: "Delete a message" })
      .input(z.object({ id: id() }))
      .mutation(async ({ input }) => {
        await findOrThrow(
          Q.discord.auto.message.find({ id: input.id }),
          "Message not found",
        );

        await Q.discord.auto.message.delete({ id: input.id });
      }),

    reorder: adminProcedure
      .meta({ description: "Bulk update sort order for messages" })
      .input(
        z.object({
          items: z.array(
            z.object({
              id: id(),
              sortOrder: z.number().int(),
            }),
          ),
        }),
      )
      .mutation(async ({ input }) => {
        const reordered = await Q.discord.auto.message.reorder(input.items);
        if (reordered < new Set(input.items.map((item) => item.id)).size) {
          throw trpcError.notFound("Message not found");
        }
      }),
  }),
});
