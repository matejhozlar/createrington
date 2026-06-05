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
import { ComponentColors } from "../../colors";
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
  /** Add the warning-colored stripe (off by default) */
  accent?: boolean;
}

export interface FeatureSpotlight {
  title: string;
  description: string;
  imageUrls: string[];
  learnMoreUrl?: string;
  /** Add the info-colored stripe (off by default) */
  accent?: boolean;
}

/** Components V2 presets for server-wide announcements */
export const AnnouncementComponentPresets = {
  /** A maintenance notice with timing, an optional icon, and a status link */
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
          data.accent ? { accentColor: ComponentColors.Warning } : {},
        ),
      ],
    };
  },

  /** A feature spotlight with a media gallery and an optional details link */
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
          data.accent ? { accentColor: ComponentColors.Info } : {},
        ),
      ],
    };
  },
};
