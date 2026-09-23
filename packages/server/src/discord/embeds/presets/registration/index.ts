import { EmbedColors } from "../../colors";
import { createEmbed } from "../../embed-builder";

export const RegistrationEmbedPresets = {
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
