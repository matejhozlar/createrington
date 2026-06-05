import { z } from "zod";
import { adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import { trpcError, auditActor } from "@/trpc/utils";
import {
  embedBotSchema,
  messagePayloadSchema,
} from "@createrington/shared/api/embed";
import {
  getMessageService,
  buildMessage,
  payloadToStorage,
  toEditOptions,
} from "./helpers";

export const embedLinkedMessageProcedures = {
  updateAll: adminProcedure
    .meta({
      description: "Update a preset and all its linked messages at once.",
    })
    .input(
      z
        .object({
          presetId: z.number().int().positive(),
          bot: embedBotSchema.default("main"),
        })
        .and(messagePayloadSchema),
    )
    .mutation(async ({ input, ctx }) => {
      const built = buildMessage(input, input.presetId);
      if (!built.ok) {
        throw trpcError.badRequest(built.error);
      }

      await Q.discord.embed.preset.update(
        { id: input.presetId },
        { data: payloadToStorage(input).data },
      );

      const links = await Q.discord.embed.preset.message
        .where({ presetId: input.presetId })
        .all();

      const messageService = getMessageService(input.bot);

      let updated = 0;
      const errors: string[] = [];

      for (const link of links) {
        const result = await messageService.edit(
          toEditOptions(built, link.channelId, link.messageId),
        );

        if (result.success) {
          updated++;
        } else {
          errors.push(`${link.messageId}: ${result.error ?? "Unknown error"}`);
        }
      }

      await Q.admin.log.action.logAction({
        ...auditActor(ctx),
        actionType: "embed_update_all",
        description: `Updated preset #${input.presetId} and ${updated}/${links.length} linked messages`,
        metadata: { presetId: input.presetId, updated, failed: errors.length },
      });

      return { updated, failed: errors.length, errors };
    }),

  updateLink: adminProcedure
    .meta({
      description: "Update a single linked message with current builder data.",
    })
    .input(
      z
        .object({
          linkId: z.number().int().positive(),
          bot: embedBotSchema.default("main"),
        })
        .and(messagePayloadSchema),
    )
    .mutation(async ({ input }) => {
      const link = await Q.discord.embed.preset.message.find({
        id: input.linkId,
      });
      if (!link) {
        throw trpcError.notFound("Link not found");
      }

      const built = buildMessage(input, link.presetId);
      if (!built.ok) {
        throw trpcError.badRequest(built.error);
      }

      const messageService = getMessageService(input.bot);

      const result = await messageService.edit(
        toEditOptions(built, link.channelId, link.messageId),
      );

      if (!result.success) {
        throw trpcError.internal(
          result.error ?? "Failed to update linked message",
        );
      }

      return { messageId: result.messageId };
    }),
};
