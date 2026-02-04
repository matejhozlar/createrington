import config from "@/config";
import { EmbedColors } from "../../colors";
import { createEmbed } from "../../embed-builder";
import { Discord } from "@/discord/constants";

export const TicketEmbedPresets = {
  /**
   * Creates a Ticket panel embed
   */
  panel() {
    const embed = createEmbed()
      .title("🎟️ Support Ticket")
      .description(
        "To create a ticket, click the **Create Ticket** button below.",
      )
      .color(EmbedColors.Info)
      .fields([
        {
          name: "Need help?",
          value: "Click the button below to open a private support thread.",
        },
        {
          name: " ",
          value: `[${config.meta.name}](${config.meta.links.website})`,
        },
      ]);

    return embed;
  },

  /**
   * Creates a Ticket welcome embed
   */
  welcome(userId: string, minecraftUsername: string) {
    const embed = createEmbed()
      .description(
        `👋 Welcome ${Discord.Users.mention(
          userId,
        )} (Minecraft: **${minecraftUsername}**)
            \nPlease describe your issue in detail and include any screenshots or videos.
            \n Support will be with you shortly ${Discord.Roles.mention(
              Discord.Roles.ADMIN,
            )}
            \nTo close this ticket, press the **Close** button below.
            `,
      )
      .color(EmbedColors.Info)
      .field(" ", `[${config.meta.name}](${config.meta.links.website})`)
      .timestamp();

    return embed;
  },

  /**
   * Creates a Ticket closure embed
   */
  close(closedBy: string) {
    const embed = createEmbed()
      .title("🔒 Ticket Closed")
      .description(
        `This ticket has been closed by ${Discord.Users.mention(
          closedBy,
        )}.\n\n` +
          `The channel will remain open for review. Use the buttons below if you need to reopen or delete`,
      )
      .color(EmbedColors.Error)
      .timestamp();

    return embed;
  },
};
