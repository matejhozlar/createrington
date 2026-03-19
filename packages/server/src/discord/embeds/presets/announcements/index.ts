import { EmbedColors } from "../../colors";
import { createEmbed } from "../../embed-builder";

export interface ChangelogMod {
  name: string;
  url: string;
}

export interface ChangelogData {
  version: string;
  added: ChangelogMod[];
  removed: ChangelogMod[];
  updated: ChangelogMod[];
}

export type MaintenanceType = "maintenance" | "modpack_update";

export interface MaintenanceData {
  type: MaintenanceType;
  startsAt: Date;
  estimatedMinutes: number;
}

const MAINTENANCE_CONFIG: Record<
  MaintenanceType,
  { title: string; description: string }
> = {
  maintenance: {
    title: "Server Maintenance",
    description:
      "The server will be going offline for scheduled maintenance to improve stability and performance.",
  },
  modpack_update: {
    title: "Modpack & Server Update",
    description:
      "We're rolling out a modpack and server update to improve stability, performance, and add new content.",
  },
};

/** Converts a list of mods into a markdown bullet list of linked mod names */
function formatModList(mods: ChangelogMod[]): string {
  return mods.map((m) => `- [${m.name}](${m.url})`).join("\n");
}

function formatDiscordTimestamp(date: Date, style: "f" | "R"): string {
  const timestamp = Math.floor(date.getTime() / 1000);
  return `<t:${timestamp}:${style}>`;
}

export const AnnouncementEmbedPresets = {
  /** Creates a modpack update announcement embed with added, removed, and updated mod lists */
  modpackUpdate(data: ChangelogData) {
    const embed = createEmbed()
      .title(`Createrington: Cogs & Steam ${data.version} Modpack Update`)
      .description(
        `A new version of the modpack is now available! Please update to **${data.version}** to receive the latest improvements and fixes.`,
      )
      .color(EmbedColors.Info);

    if (data.added.length > 0) {
      embed.field("🆕 New Mods", formatModList(data.added));
    }
    if (data.removed.length > 0) {
      embed.field("🗑️ Removed Mods", formatModList(data.removed));
    }
    if (data.updated.length > 0) {
      embed.field("⬆️ Updated Mods", formatModList(data.updated));
    }

    embed
      .field(
        "📢 Reminder",
        "Please update the modpack to the latest version.\nIf you encounter any issues or bugs, let the team know!",
      )
      .footer("Thanks for playing on Createrington!")
      .timestamp();

    return embed;
  },

  /** Creates a maintenance/update announcement embed with start time, duration, and expected end */
  maintenance(data: MaintenanceData) {
    const cfg = MAINTENANCE_CONFIG[data.type];
    const endTime = new Date(
      data.startsAt.getTime() + data.estimatedMinutes * 60000,
    );

    return createEmbed()
      .title(`🔧 ${cfg.title}`)
      .description(cfg.description)
      .color(EmbedColors.Warning)
      .fields([
        {
          name: "🕒 Starts",
          value: `${formatDiscordTimestamp(data.startsAt, "f")} (${formatDiscordTimestamp(data.startsAt, "R")})`,
        },
        {
          name: "⏳ Estimated Duration",
          value: `${data.estimatedMinutes} minutes`,
        },
        {
          name: "🔚 Expected End",
          value: `${formatDiscordTimestamp(endTime, "f")} (${formatDiscordTimestamp(endTime, "R")})`,
        },
      ])
      .footer("Thanks for your patience!")
      .timestamp();
  },
};
