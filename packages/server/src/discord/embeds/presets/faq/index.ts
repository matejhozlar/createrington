import { channelMention } from "discord.js";
import { createEmbed } from "@/discord/embeds/embed-builder";
import { EmbedColors } from "@/discord/embeds/colors";
import { Discord } from "@/discord/constants";

export const FaqEmbedPresets = {
  welcomeMessage() {
    const ch = Discord.Channels;

    const channels = [
      channelMention(ch.createringtonOfficial.SUPPORT),
      channelMention(ch.createringtonOfficial.RULES),
      channelMention(ch.general.COMMANDS),
      channelMention(ch.createringtonOfficial.ANNOUNCEMENTS),
      channelMention(ch.createringtonOfficial.DOWNLOAD),
      channelMention(ch.createringtonOfficial.ROLES),
    ].join("  ");

    return createEmbed()
      .title("Welcome to Questions!")
      .description(
        "Have a question? Just type it here and we'll try to help!\n\n" +
          `**Useful channels**\n${channels}`,
      )
      .color(EmbedColors.Info);
  },

  faqReply(title: string, response: string) {
    return createEmbed()
      .title(title)
      .description(response)
      .color(EmbedColors.Info)
      .footer("FAQ Auto-Response");
  },
};
