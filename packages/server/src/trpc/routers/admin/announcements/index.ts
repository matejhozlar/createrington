import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import { trpcError, auditActor } from "@/trpc/utils";
import { getServiceSync, Services } from "@/services";
import { DiscordMessageService } from "@/services/discord/message/message.service";
import { Discord } from "@/discord/constants";
import { EmbedPresets } from "@/discord/embeds";

const sendMaintenanceInput = z.object({
  type: z.enum(["maintenance", "modpack_update"]),
  startsAt: z.string().datetime({ offset: true }),
  estimatedMinutes: z.number().int().min(1).max(10080),
});

/** Admin announcements router: maintenance announcements. */
export const announcementsRouter = router({
  sendMaintenance: adminProcedure
    .meta({
      description:
        "Build and send a maintenance announcement embed to the announcements channel",
    })
    .input(sendMaintenanceInput)
    .mutation(async ({ input, ctx }) => {
      const embed = EmbedPresets.announcements.maintenance({
        type: input.type,
        startsAt: new Date(input.startsAt),
        estimatedMinutes: input.estimatedMinutes,
      });

      const mainBot = getServiceSync(Services.DISCORD_MAIN_BOT);
      const messageService = DiscordMessageService.getInstance(mainBot);

      const result = await messageService.send({
        channelId: Discord.Channels.createringtonOfficial.ANNOUNCEMENTS,
        embeds: embed.build(),
      });

      if (!result.success) {
        throw trpcError.internal(
          result.error ?? "Failed to send maintenance announcement",
        );
      }

      await Q.admin.log.action.logAction({
        ...auditActor(ctx),
        actionType: "announcement_maintenance",
        description: `Sent ${input.type} announcement (starts ${input.startsAt}, ~${input.estimatedMinutes}min)`,
        metadata: {
          type: input.type,
          startsAt: input.startsAt,
          estimatedMinutes: input.estimatedMinutes,
        },
      });

      return { messageId: result.messageId };
    }),
});
