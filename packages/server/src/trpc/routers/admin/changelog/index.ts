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

export const changelogRouter = router({
  searchMods: adminProcedure
    .input(z.object({ query: z.string().min(1).max(100) }))
    .query(async ({ input }) => {
      if (!config.curseforge.apiKey) {
        throw trpcError.internal("CurseForge API key not configured");
      }

      const results = await searchMods(input.query);
      return { mods: results };
    }),

  send: adminProcedure.input(sendChangelogInput).mutation(async ({ input }) => {
    const { version, added, removed, updated } = input;

    if (added.length === 0 && removed.length === 0 && updated.length === 0) {
      throw trpcError.badRequest(
        "Changelog must have at least one mod in added, removed, or updated.",
      );
    }

    const embed = EmbedPresets.changelog.modpackUpdate({
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

    const webBot = getServiceSync(Services.DISCORD_WEB_BOT);
    const messageService = DiscordMessageService.getInstance(webBot);

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
});
