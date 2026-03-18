import { createEmbed } from "@/discord/embeds/embed-builder";
import { EmbedColors } from "@/discord/embeds/colors";
import { Discord } from "@/discord/constants";

/** Embed presets for the FAQ channel (welcome header and auto-response answers) */
export const FaqEmbedPresets = {
  /** Pinned welcome embed with useful channel links for the questions channel */
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

  /** Auto-response embed shown when a user's question matches a known FAQ entry */
  faqReply(title: string, response: string) {
    return createEmbed()
      .title(title)
      .description(response)
      .color(EmbedColors.Info)
      .footer("FAQ Auto-Response");
  },
};
