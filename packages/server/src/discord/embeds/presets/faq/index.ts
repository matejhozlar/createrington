import { createEmbed } from "@/discord/embeds/embed-builder";
import { EmbedColors } from "@/discord/embeds/colors";
import { Discord } from "@/discord/constants";

export const FaqEmbedPresets = {
  welcomeMessage() {
    const ch = Discord.Channels;
    const m = ch.mention.bind(ch);

    const channels = [
      m(ch.createringtonOfficial.SUPPORT),
      m(ch.createringtonOfficial.RULES),
      m(ch.general.COMMANDS),
      m(ch.createringtonOfficial.ANNOUNCEMENTS),
      m(ch.createringtonOfficial.DOWNLOAD),
      m(ch.createringtonOfficial.ROLES),
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
