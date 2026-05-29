import { z } from "zod";
import { adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import { trpcError } from "@/trpc/utils";
import {
  embedDataSchema,
  embedBotSchema,
  type EmbedData,
} from "@createrington/shared/api/embed";
import {
  getMessageService,
  hasEmbedContent,
  buildDiscordEmbed,
  buildButtons,
} from "./helpers";

export const embedLinkedMessageProcedures = {
  updateAll: adminProcedure
    .meta({
      description: "Update a preset and all its linked messages at once.",
    })
    .input(
      z.object({
        presetId: z.number().int().positive(),
        embed: embedDataSchema,
        bot: embedBotSchema.default("main"),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const data = input.embed as EmbedData;

      if (!data.content && !hasEmbedContent(data)) {
        throw trpcError.badRequest(
          "Message must have content, a title, a description, or at least one field",
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
      const components = buildButtons(data, input.presetId);
      const messageService = getMessageService(input.bot);

      let updated = 0;
      const errors: string[] = [];

      for (const link of links) {
        const result = await messageService.edit({
          channelId: link.channelId,
          messageId: link.messageId,
          content: data.content ?? null,
          embeds: embed ?? null,
          components: components ?? null,
        });

        if (result.success) {
          updated++;
        } else {
          errors.push(`${link.messageId}: ${result.error ?? "Unknown error"}`);
        }
      }

      await Q.admin.log.action.logAction({
        adminDiscordId: ctx.user.discordId,
        adminUsername: ctx.user.minecraftUsername,
        actionType: "embed_update_all",
        description: `Updated preset #${input.presetId} and ${updated}/${links.length} linked messages`,
        metadata: { presetId: input.presetId, updated, failed: errors.length },
      });

      return { updated, failed: errors.length, errors };
    }),

  updateLink: adminProcedure
    .meta({
      description: "Update a single linked message with current embed data.",
    })
    .input(
      z.object({
        linkId: z.number().int().positive(),
        embed: embedDataSchema,
        bot: embedBotSchema.default("main"),
      }),
    )
    .mutation(async ({ input }) => {
      const data = input.embed as EmbedData;

      if (!data.content && !hasEmbedContent(data)) {
        throw trpcError.badRequest(
          "Message must have content, a title, a description, or at least one field",
        );
      }

      const link = await Q.discord.embed.preset.message.find({
        id: input.linkId,
      });
      if (!link) {
        throw trpcError.notFound("Link not found");
      }

      const embed = buildDiscordEmbed(data);
      const components = buildButtons(data, link.presetId);
      const messageService = getMessageService(input.bot);

      const result = await messageService.edit({
        channelId: link.channelId,
        messageId: link.messageId,
        content: data.content ?? null,
        embeds: embed ?? null,
        components: components ?? null,
      });

      if (!result.success) {
        throw trpcError.internal(
          result.error ?? "Failed to update linked message",
        );
      }

      return { messageId: result.messageId };
    }),
};
