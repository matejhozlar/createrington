import { Discord } from "@/discord/constants";
import { z } from "zod";
import { adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import { findOrThrow, trpcError, auditActor, id } from "@/trpc/utils";
import {
  embedBotSchema,
  messagePayloadSchema,
} from "@createrington/shared/api/embed";
import { isMessageGone } from "@/services/discord/message/errors";
import { buildMessage, payloadToStorage, toEditOptions } from "./helpers";

export const embedLinkedMessageProcedures = {
  updateAll: adminProcedure
    .meta({
      description: "Update a preset and all its linked messages at once.",
    })
    .input(
      z
        .object({
          presetId: id(),
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

      let updated = 0;
      const errors: string[] = [];

      for (const link of links) {
        try {
          await Discord.Messages.edit(
            toEditOptions(built, link.channelId, link.messageId),
          );
          updated++;
        } catch (error) {
          logger.warn(
            `Could not update linked message ${link.messageId}:`,
            error,
          );
          errors.push(
            `${link.messageId}: ${isMessageGone(error) ? "message no longer exists" : "update failed"}`,
          );
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
          linkId: id(),
          bot: embedBotSchema.default("main"),
        })
        .and(messagePayloadSchema),
    )
    .mutation(async ({ input }) => {
      const link = await findOrThrow(
        Q.discord.embed.preset.message.find({ id: input.linkId }),
        "Link not found",
      );

      const built = buildMessage(input, link.presetId);
      if (!built.ok) {
        throw trpcError.badRequest(built.error);
      }

      const edited = await Discord.Messages.edit(
        toEditOptions(built, link.channelId, link.messageId),
      );

      return { messageId: edited.id };
    }),
};
