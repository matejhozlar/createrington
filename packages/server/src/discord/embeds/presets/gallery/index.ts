import { createEmbed } from "@/discord/embeds/embed-builder";
import { EmbedColors } from "@/discord/embeds/colors";

/** Embed presets for the screenshot gallery (submission channel notice) */
export const GalleryEmbedPresets = {
  /** Sticky notice kept at the bottom of the gallery submissions channel */
  intakeNotice() {
    return createEmbed()
      .title("Submit your screenshots to the gallery")
      .description(
        "Post your screenshots here and the bot picks them up as gallery submissions. " +
          "Admins review each one, and approved screenshots are published on the website with credit to you.\n\n" +
          "By posting in this channel you agree that approved screenshots may be shown on the website, credited to you.",
      )
      .color(EmbedColors.Info);
  },
};
