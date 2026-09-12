import { createEmbed } from "@/discord/embeds/embed-builder";
import { EmbedColors } from "@/discord/embeds/colors";
import { formatMoney } from "@createrington/shared/format";

export interface GalleryApprovalEmbedInput {
  authorDiscordId: string;
  caption: string | null;
  creditNames: string[];
  rewardAmount: number;
  imageUrl: string;
  galleryUrl: string;
}

const RULES = [
  "Only screenshots taken on the Createrington server, of your own build or with the builder credited in your message.",
  "Shaders are strongly preferred. Hide the HUD (F1) and keep the debug screen off.",
  "No edited, upscaled, or AI-generated images. Cropping is fine.",
  "One build per message, with a short caption saying what we are looking at.",
];

/** Embed presets for the screenshot gallery (submission channel notice, approval announcements) */
export const GalleryEmbedPresets = {
  /** Sticky notice kept at the bottom of the gallery submissions channel, showing the rules and the current reward */
  intakeNotice(rewardAmount: number) {
    const reward =
      rewardAmount > 0
        ? `Approved screenshots are published on the website with credit to you and earn **${formatMoney(rewardAmount)}** in-game currency.`
        : "Approved screenshots are published on the website with credit to you.";

    return createEmbed()
      .title("Submit your screenshots to the gallery")
      .description(
        "Post your screenshots here and the bot picks them up as gallery submissions. " +
          `Admins review each one. ${reward}\n\n` +
          `**Rules**\n${RULES.map((rule) => `- ${rule}`).join("\n")}\n\n` +
          "By posting in this channel you agree that approved screenshots may be shown on the website, credited to you.",
      )
      .color(EmbedColors.Info);
  },

  /** Announcement posted in the gallery channel when a screenshot is approved */
  approvalAnnouncement(input: GalleryApprovalEmbedInput) {
    const lines = [`Screenshot by <@${input.authorDiscordId}>`];

    if (input.caption) {
      lines.push("", input.caption);
    }

    if (input.creditNames.length > 0) {
      lines.push("", `Also featuring: ${input.creditNames.join(", ")}`);
    }

    if (input.rewardAmount > 0) {
      lines.push(
        "",
        `Reward: **${formatMoney(input.rewardAmount)}** in-game currency`,
      );
    }

    return createEmbed()
      .title("New gallery screenshot")
      .url(input.galleryUrl)
      .description(lines.join("\n"))
      .image(input.imageUrl)
      .color(EmbedColors.Success)
      .timestamp(new Date());
  },
};
