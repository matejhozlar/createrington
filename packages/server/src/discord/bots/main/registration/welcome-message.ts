import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import {
  createEmbed,
  DiscordEmbedBuilder,
} from "@/discord/embeds/embed-builder";
import { EmbedColors } from "@/discord/embeds/colors";

/** Custom ID of the button that opens the registration modal */
export const REGISTER_BUTTON_ID = "registration:open";

/** Custom ID of the modal that collects the Minecraft username */
export const REGISTER_MODAL_ID = "registration:submit";

/** Custom ID of the text input inside the modal */
export const REGISTER_MODAL_INPUT_ID = "mc_name";

/** Builds the idle "click here to register" embed + button that anchors the
 * verification channel. Optionally shows an error banner when the user retries
 * after a failed attempt. */
export function buildIdleWelcomeMessage(params: {
  memberMention: string;
  errorMessage?: string;
}): {
  embeds: DiscordEmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder>[];
} {
  const embed = createEmbed()
    .title("🎉 Welcome to Createrington!")
    .description(
      `Hey ${params.memberMention}, we're so glad you're here.\n\n` +
        `You're one step away from joining the server. Click **Register** below and drop in your Minecraft username, and we'll handle the whitelist and setup for you.\n\n` +
        `See you in-game soon. ⛏️`,
    )
    .color(params.errorMessage ? EmbedColors.Error : EmbedColors.Success);

  if (params.errorMessage) {
    embed.field("Last attempt failed", params.errorMessage, false);
  }

  const button = new ButtonBuilder()
    .setCustomId(REGISTER_BUTTON_ID)
    .setLabel("Register")
    .setStyle(ButtonStyle.Primary)
    .setEmoji("🎮");

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

  return { embeds: [embed], components: [row] };
}
