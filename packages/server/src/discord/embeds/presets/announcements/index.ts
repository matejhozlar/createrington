import { EmbedColors } from "../../colors";
import { createEmbed } from "../../embed-builder";

export interface ChangelogMod {
  name: string;
  url: string;
  version?: string;
}

export interface ChangelogHighlight {
  title: string;
  description: string;
}

export interface ChangelogData {
  version: string;
  added: ChangelogMod[];
  removed: ChangelogMod[];
  updated: ChangelogMod[];
  highlights?: ChangelogHighlight[];
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
  return mods
    .map((m) => {
      const link = `[${m.name}](${m.url})`;
      return m.version ? `- ${link} — \`${m.version}\`` : `- ${link}`;
    })
    .join("\n");
}

/** Formats a Date as a Discord timestamp tag (`<t:unix:style>`) */
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

    if (data.highlights && data.highlights.length > 0) {
      for (const h of data.highlights) {
        embed.field(h.title, h.description);
      }
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

  /** Creates a warning embed sent at intervals before scheduled maintenance begins */
  maintenanceWarning(data: { startsAt: Date; minutesBefore: number }) {
    return createEmbed()
      .title("⚠️ Maintenance Starting Soon")
      .description(
        `Server maintenance begins ${formatDiscordTimestamp(data.startsAt, "R")}`,
      )
      .color(EmbedColors.Warning)
      .field(
        "Time Remaining",
        `${data.minutesBefore} minute${data.minutesBefore !== 1 ? "s" : ""}`,
      )
      .footer("Players will be kicked when maintenance begins.")
      .timestamp();
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

  /** Creates an embed announcing that maintenance has ended and the server is back online */
  maintenanceEnded() {
    return createEmbed()
      .title("✅ Maintenance Complete")
      .description(
        "Server maintenance has been completed and the server is back online. Thanks for your patience!",
      )
      .color(EmbedColors.Success)
      .timestamp();
  },
};
