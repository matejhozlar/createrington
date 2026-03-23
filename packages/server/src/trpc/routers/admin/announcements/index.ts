import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { trpcError } from "@/trpc/utils";
import { getServiceSync, Services } from "@/services";
import { DiscordMessageService } from "@/services/discord/message/message.service";
import { Discord } from "@/discord/constants";
import { EmbedPresets } from "@/discord/embeds";
import { searchMods } from "@/services/curseforge";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import config from "@/config";

const changelogModSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
});

const sendChangelogInput = z.object({
  version: z.string().min(1).max(20),
  added: z.array(changelogModSchema),
  removed: z.array(changelogModSchema),
  updated: z.array(changelogModSchema),
});

const sendMaintenanceInput = z.object({
  type: z.enum(["maintenance", "modpack_update"]),
  startsAt: z.string().datetime({ offset: true }),
  estimatedMinutes: z.number().int().min(1).max(10080),
});

/** Admin announcements router — modpack changelogs and maintenance announcements. */
export const announcementsRouter = router({
  searchMods: adminProcedure
    .meta({
      description:
        "Search CurseForge for mods by query string. Requires the CurseForge API key to be configured",
    })
    .input(z.object({ query: z.string().min(1).max(100) }))
    .query(async ({ input }) => {
      if (!config.curseforge.apiKey) {
        throw trpcError.internal("CurseForge API key not configured");
      }

      const results = await searchMods(input.query);
      return { mods: results };
    }),

  sendChangelog: adminProcedure
    .meta({
      description:
        "Build and send a modpack changelog embed to the announcements channel. At least one mod must appear in added, removed, or updated",
    })
    .input(sendChangelogInput)
    .mutation(async ({ input }) => {
      const { version, added, removed, updated } = input;

      if (added.length === 0 && removed.length === 0 && updated.length === 0) {
        throw trpcError.badRequest(
          "Changelog must have at least one mod in added, removed, or updated.",
        );
      }

      const embed = EmbedPresets.announcements.modpackUpdate({
        version,
        added,
        removed,
        updated,
      });

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel("Download Update")
          .setStyle(ButtonStyle.Link)
          .setURL(config.meta.links.modpack),
      );

      const mainBot = getServiceSync(Services.DISCORD_MAIN_BOT);
      const messageService = DiscordMessageService.getInstance(mainBot);

      const result = await messageService.send({
        channelId: Discord.Channels.createringtonOfficial.ANNOUNCEMENTS,
        embeds: embed.build(),
        components: [row],
      });

      if (!result.success) {
        throw trpcError.internal(result.error ?? "Failed to send changelog");
      }

      return { messageId: result.messageId };
    }),

  sendMaintenance: adminProcedure
    .meta({
      description:
        "Build and send a maintenance announcement embed to the announcements channel",
    })
    .input(sendMaintenanceInput)
    .mutation(async ({ input }) => {
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

      return { messageId: result.messageId };
    }),
});
