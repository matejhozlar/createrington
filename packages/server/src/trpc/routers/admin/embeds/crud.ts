import { z } from "zod";
import { adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import { trpcError, auditActor } from "@/trpc/utils";
import config from "@/config";
import {
  embedBotSchema,
  messagePayloadSchema,
} from "@createrington/shared/api/embed";
import {
  embedSendLimit,
  getMessageService,
  buildMessage,
  payloadToStorage,
  toSendOptions,
  toEditOptions,
} from "./helpers";

const colors = config.discord.embeds.colors;

export const embedCrudProcedures = {
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

  roles: adminProcedure
    .meta({ description: "Get all Discord roles" })
    .query(() => {
      const roles = config.discord.guild.roles;
      return Object.entries(roles as unknown as Record<string, string>).map(
        ([name, id]) => ({ name, id }),
      );
    }),

  colors: adminProcedure
    .meta({ description: "Get all available embed colors" })
    .query(() => {
      return Object.entries(colors).map(([name, value]) => ({
        name,
        value: value as number,
        hex: `#${(value as number).toString(16).padStart(6, "0")}`,
      }));
    }),

  send: adminProcedure
    .use(embedSendLimit)
    .meta({ description: "Send an embed or components message to a channel" })
    .input(
      z
        .object({
          channelId: z.string().min(1),
          presetId: z.number().int().positive().optional(),
          bot: embedBotSchema.default("main"),
        })
        .and(messagePayloadSchema),
    )
    .mutation(async ({ input, ctx }) => {
      const { channelId } = input;

      const built = buildMessage(input, input.presetId);
      if (!built.ok) {
        throw trpcError.badRequest(built.error);
      }

      const messageService = getMessageService(input.bot);

      const result = await messageService.send(toSendOptions(built, channelId));

      if (!result.success) {
        throw trpcError.internal(result.error ?? "Failed to send message");
      }

      if (input.presetId && result.messageId) {
        await Q.discord.embed.preset.message.create({
          presetId: input.presetId,
          channelId: input.channelId,
          messageId: result.messageId,
        });
      }

      const label =
        input.kind === "embed" && input.embed.title
          ? `: "${input.embed.title}"`
          : "";
      await Q.admin.log.action.logAction({
        ...auditActor(ctx),
        actionType: "embed_send",
        description: `Sent ${input.kind === "components" ? "components message" : "embed"} to channel ${channelId}${label}`,
        metadata: {
          channelId,
          kind: input.kind,
          presetId: input.presetId,
          messageId: result.messageId,
        },
      });

      return { messageId: result.messageId };
    }),

  edit: adminProcedure
    .meta({ description: "Edit an existing embed or components message" })
    .input(
      z
        .object({
          channelId: z.string().min(1),
          messageId: z.string().min(1),
          presetId: z.number().int().positive().optional(),
          bot: embedBotSchema.default("main"),
        })
        .and(messagePayloadSchema),
    )
    .mutation(async ({ input, ctx }) => {
      const { channelId, messageId } = input;

      const built = buildMessage(input, input.presetId);
      if (!built.ok) {
        throw trpcError.badRequest(built.error);
      }

      const messageService = getMessageService(input.bot);

      const result = await messageService.edit(
        toEditOptions(built, channelId, messageId),
      );

      if (!result.success) {
        throw trpcError.internal(result.error ?? "Failed to edit message");
      }

      if (input.presetId) {
        await Q.discord.embed.preset.update(
          { id: input.presetId },
          { data: payloadToStorage(input).data },
        );
      }

      await Q.admin.log.action.logAction({
        ...auditActor(ctx),
        actionType: "embed_edit",
        description: `Edited message ${messageId} in channel ${channelId}`,
        metadata: {
          channelId,
          messageId,
          kind: input.kind,
          presetId: input.presetId,
        },
      });

      return { messageId: result.messageId };
    }),

  fetchMessage: adminProcedure
    .meta({ description: "Fetch an embed message from a channel" })
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
      const content = result.message.content || undefined;

      if (!embed && !content) {
        throw trpcError.notFound("Message has no content or embeds");
      }

      return {
        content,
        title: embed?.title ?? undefined,
        description: embed?.description ?? undefined,
        color: embed?.color ?? undefined,
        url: embed?.url ?? undefined,
        footer: embed?.footer?.text ?? undefined,
        author: embed?.author?.name ?? undefined,
        authorUrl: embed?.author?.url ?? undefined,
        authorIconUrl: embed?.author?.iconURL ?? undefined,
        thumbnailUrl: embed?.thumbnail?.url ?? undefined,
        imageUrl: embed?.image?.url ?? undefined,
        timestamp: !!embed?.timestamp,
        fields:
          embed?.fields.map((f) => ({
            name: f.name,
            value: f.value,
            inline: f.inline ?? false,
          })) ?? [],
      };
    }),
};
