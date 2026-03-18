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

/** Converts a list of mods into a markdown bullet list of linked mod names */
function formatModList(mods: ChangelogMod[]): string {
  return mods.map((m) => `- [${m.name}](${m.url})`).join("\n");
}

export const ChangelogEmbedPresets = {
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
};
