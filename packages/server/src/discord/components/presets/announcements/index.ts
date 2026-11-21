import {
  actionRow,
  container,
  linkButton,
  mediaGallery,
  section,
  separator,
  text,
  thumbnail,
} from "../../component-builder";
import { EmbedColors } from "@/discord/embeds/colors";
import { discordTimestamp } from "@/utils/format";
import type {
  ComponentContainer,
  ComponentsData,
} from "@createrington/shared/api/embed";

export interface MaintenanceAnnouncement {
  title: string;
  description: string;
  startsAt: Date;
  estimatedMinutes: number;
  iconUrl?: string;
  statusUrl?: string;
  accent?: boolean;
}

export interface FeatureSpotlight {
  title: string;
  description: string;
  imageUrls: [string, ...string[]];
  learnMoreUrl?: string;
  accent?: boolean;
}

export const AnnouncementComponentPresets = {
  maintenance(data: MaintenanceAnnouncement): ComponentsData {
    const body = [
      `**${data.title}**`,
      data.description,
      "",
      `Starts ${discordTimestamp(data.startsAt, "F")} (${discordTimestamp(
        data.startsAt,
        "R",
      )})`,
      `Estimated downtime: **${data.estimatedMinutes} min**`,
    ].join("\n");

    const children: ComponentContainer["components"] = [
      data.iconUrl ? section([body], thumbnail(data.iconUrl)) : text(body),
    ];

    if (data.statusUrl) {
      children.push(separator());
      children.push(
        actionRow([linkButton("Service status", data.statusUrl, "🛠️")]),
      );
    }

    return {
      components: [
        container(
          children,
          data.accent ? { accentColor: EmbedColors.Warning } : {},
        ),
      ],
    };
  },

  spotlight(data: FeatureSpotlight): ComponentsData {
    const children: ComponentContainer["components"] = [
      text(`✨ **${data.title}**`),
      text(data.description),
      mediaGallery(data.imageUrls.map((url) => ({ url }))),
    ];

    if (data.learnMoreUrl) {
      children.push(separator());
      children.push(actionRow([linkButton("Learn more", data.learnMoreUrl)]));
    }

    return {
      components: [
        container(
          children,
          data.accent ? { accentColor: EmbedColors.Info } : {},
        ),
      ],
    };
  },
};
