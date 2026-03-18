import { createEmbed } from "@/discord/embeds/embed-builder";
import { EmbedColors } from "@/discord/embeds/colors";
import { Discord } from "@/discord/constants";

/** Embed presets for the FAQ channel (welcome header and auto-response answers) */
export const FaqEmbedPresets = {
  /** Pinned welcome embed with useful channel links for the questions channel */
  welcomeMessage() {
    return createEmbed()
      .title("Welcome to Questions!")
      .description("Have a question? Just type it here and we'll try to help!")
      .field(
        "Support",
        Discord.Channels.mention(
          Discord.Channels.createringtonOfficial.SUPPORT,
        ),
        true,
      )
      .field(
        "Rules",
        Discord.Channels.mention(Discord.Channels.createringtonOfficial.RULES),
        true,
      )
      .field(
        "Commands",
        Discord.Channels.mention(Discord.Channels.general.COMMANDS),
        true,
      )
      .field(
        "Announcements",
        Discord.Channels.mention(
          Discord.Channels.createringtonOfficial.ANNOUNCEMENTS,
        ),
        true,
      )
      .field(
        "Download",
        Discord.Channels.mention(
          Discord.Channels.createringtonOfficial.DOWNLOAD,
        ),
        true,
      )
      .field(
        "Roles",
        Discord.Channels.mention(Discord.Channels.createringtonOfficial.ROLES),
        true,
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
