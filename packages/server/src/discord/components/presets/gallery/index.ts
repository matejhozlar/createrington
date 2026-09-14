import { escapeMarkdown } from "discord.js";
import {
  actionRow,
  container,
  linkButton,
  mediaGallery,
  separator,
  text,
} from "../../component-builder";
import { ComponentColors } from "../../colors";
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

function details(input: GalleryApprovalAnnouncementInput): string {
  const lines = [`### Screenshot by <@${input.authorDiscordId}>`];
  if (input.caption) {
    lines.push(escapeMarkdown(input.caption));
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

/** Components V2 renderings for the screenshot gallery channel. */
export const GalleryComponentPresets = {
  /** The approval announcement: the published image, author mention, caption, credits, reward, and a link to the website gallery. */
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
          { accentColor: ComponentColors.Success },
        ),
      ],
    };
  },
};
