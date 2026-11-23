import { escapeMarkdown, userMention } from "discord.js";
import {
  actionRow,
  container,
  linkButton,
  mediaGallery,
  separator,
  text,
} from "../../component-builder";
import { EmbedColors } from "@/discord/embeds/colors";
import { formatMoney } from "@createrington/shared/format";
import type { ComponentsData } from "@createrington/shared/api/embed";

export interface GalleryApprovalAnnouncementInput {
  authorDiscordId: string;
  caption: string | null;
  creditNames: string[];
  rewardAmount: number;
  imageUrl: string;
  galleryUrl: string;
}

const OPEN_GALLERY_LABEL = "Open gallery";

const CAPTION_ESCAPES = {
  heading: true,
  bulletedList: true,
  numberedList: true,
  maskedLink: true,
} as const;

function plainCaption(caption: string): string {
  return escapeMarkdown(caption, CAPTION_ESCAPES).replace(
    /^(\s*)(-#|>)/gm,
    "$1\\$2",
  );
}

function details(input: GalleryApprovalAnnouncementInput): string {
  const lines = [`### Screenshot by ${userMention(input.authorDiscordId)}`];
  if (input.caption) {
    lines.push(plainCaption(input.caption));
  }

  const meta: string[] = [];
  if (input.creditNames.length > 0) {
    meta.push(
      `Also featuring ${input.creditNames.map((name) => escapeMarkdown(name)).join(", ")}`,
    );
  }
  if (input.rewardAmount > 0) {
    meta.push(`Rewarded ${formatMoney(input.rewardAmount)} in-game currency`);
  }
  if (meta.length > 0) {
    lines.push(`-# ${meta.join(" · ")}`);
  }

  return lines.join("\n");
}

export const GalleryComponentPresets = {
  approvalAnnouncement(
    input: GalleryApprovalAnnouncementInput,
  ): ComponentsData {
    return {
      components: [
        container(
          [
            mediaGallery([
              input.caption
                ? { url: input.imageUrl, description: input.caption }
                : { url: input.imageUrl },
            ]),
            text(details(input)),
            separator(),
            actionRow([linkButton(OPEN_GALLERY_LABEL, input.galleryUrl)]),
          ],
          { accentColor: EmbedColors.Success },
        ),
      ],
    };
  },
};
