import { createEmbed } from "@/discord/embeds/embed-builder";
import { EmbedColors } from "@/discord/embeds/colors";
import { Discord } from "@/discord/constants";

/** Embed presets for the FAQ channel (welcome header and auto-response answers) */
export const FaqEmbedPresets = {
  /** Pinned welcome embed with useful channel links for the questions channel */
  welcomeMessage() {
    return createEmbed()
      .title("Welcome to Questions!")
      .description(
        [
          "Have a question? Just type it here and we'll try to help!",
          "",
          "**Useful channels:**",
          `- ${Discord.Channels.mention(Discord.Channels.createringtonOfficial.SUPPORT)} — for support tickets`,
          `- ${Discord.Channels.mention(Discord.Channels.createringtonOfficial.RULES)} — server rules`,
          `- ${Discord.Channels.mention(Discord.Channels.general.COMMANDS)} — bot commands`,
        ].join("\n"),
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
