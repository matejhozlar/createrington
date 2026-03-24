import { ButtonBuilder, ButtonStyle } from "discord.js";
import { EmbedColors } from "../../colors";
import { createEmbed, DiscordEmbedBuilder } from "../../embed-builder";
import { ProgressEmbedPresets } from "../progress";
import { Discord } from "@/discord/constants";

export const RegistrationEmbedPresets = {
  /**
   * Creates a user-facing registration progress embed
   */
  userProgress(
    username: string,
    steps: Array<{ name: string; completed: boolean; error?: string }>,
    currentStepIndex: number,
  ): DiscordEmbedBuilder {
    return ProgressEmbedPresets.create({
      title: "🔄 Registering your Minecraft account...",
      description: `**Username** \`${username}\``,
      steps,
      currentStepIndex,
      showPercentage: true,
      showProgressBar: true,
    });
  },

  /**
   * Creates a successful registration embed with close button
   */
  userSuccess(username: string, uuid: string) {
    const ch = Discord.Channels;
    const m = ch.mention.bind(ch);

    const channels = [
      m(ch.createringtonOfficial.DOWNLOAD),
      m(ch.createringtonOfficial.RULES),
      m(ch.createringtonOfficial.ROLES),
      m(ch.createringtonOfficial.ANNOUNCEMENTS),
      m(ch.general.COMMANDS),
      m(ch.createringtonOfficial.SUPPORT),
    ].join("  ");

    const embed = createEmbed()
      .title("✅ Registration Complete!")
      .description(
        `Welcome to Createrington, **${username}**!\n\n` +
          `**Getting started**\n` +
          `1. Check out the ${m(ch.createringtonOfficial.RULES)} before jumping in\n` +
          `2. Pick your ${m(ch.createringtonOfficial.ROLES)} to customize your experience\n` +
          `3. Download the modpack in ${m(ch.createringtonOfficial.DOWNLOAD)}\n` +
          `4. Join the server and have fun!\n\n` +
          `**Useful channels**\n${channels}`,
      )
      .field("Minecraft Username", `\`${username}\``, true)
      .field("UUID", `\`${uuid}\``, true)
      .color(EmbedColors.Success);

    const closeButton = new ButtonBuilder()
      .setCustomId("registration:close")
      .setLabel("Close")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("🗑️");

    return { embed, closeButton };
  },

  /**
   * Creates a registration error embed
   */
  userError(
    username: string,
    error: string,
    step: string,
  ): DiscordEmbedBuilder {
    return ProgressEmbedPresets.error(
      "Registration Failed",
      `An error occurred while registering **${username}**.\n\n**Error:** ${error}\n\nAn admin has been notified and will assist you shortly.`,
      step,
    ).footer("Please wait for admin assistance");
  },

  /** Creates an admin-facing notification embed when a registration fails */
  adminError(
    username: string,
    discordTag: string,
    discordId: string,
    error: string,
    step: string,
  ) {
    const embed = createEmbed()
      .title("⚠️ Registration Error")
      .description(
        `Registration failed for **${discordTag}** (\`${discordId}\`)`,
      )
      .field("Minecraft Username", `\`${username}\``, true)
      .field("Failed Step", step, true)
      .field("Error", error, false)
      .color(EmbedColors.Error)
      .timestamp();

    return embed;
  },
};
