import { ButtonBuilder, ButtonStyle } from "discord.js";
import { EmbedColors } from "../../colors";
import { createEmbed, DiscordEmbedBuilder } from "../../embed-builder";
import { ProgressEmbedPresets } from "../progress";

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
    const embed = createEmbed()
      .title("✅ Registration Complete!")
      .description(
        `You've been successfully registered and whitelisted as **${username}**.\n\nWelcome aboard! 🚂`,
      )
      .field("Minecraft Username", `\`${username}\``, true)
      .field("UUID", `\`${uuid}\``, true)
      .color(EmbedColors.Success)
      .footer("You can now join the server!");

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
