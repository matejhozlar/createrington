import { EmbedColors } from "../../colors";
import { createEmbed, DiscordEmbedBuilder } from "../../embed-builder";

export interface ChangeField {
  name: string;
  oldValue: string;
  newValue: string;
  inline?: boolean;
}

export interface ConfirmationEmbedOptions {
  title: string;
  description?: string;
  changes: ChangeField[];
  warnings?: string[];
  footer?: string;
}

export const ConfirmationEmbedPresets = {
  /**
   * Creates a confirmation embed showing what will change
   */
  create(options: ConfirmationEmbedOptions): DiscordEmbedBuilder {
    const { title, description, changes, warnings = [], footer } = options;

    const embed = createEmbed().title(`⚠️ ${title}`).color(EmbedColors.Warning);

    if (description) {
      embed.description(description);
    }

    changes.forEach((change) => {
      embed.field(
        change.name,
        `\`${change.oldValue}\` → \`${change.newValue}\``,
        change.inline ?? true,
      );
    });

    if (warnings.length > 0) {
      const warningsText = warnings.map((w) => `${w}`).join("\n");
      embed.field("Warnings", warningsText, false);
    }

    if (footer) {
      embed.footer(footer);
    } else {
      embed.footer("Please confirm your action");
    }

    return embed;
  },

  /**
   * Creates a simple yes/no confirmation
   */
  simple(title: string, description: string): DiscordEmbedBuilder {
    return createEmbed()
      .title(`⚠️ ${title}`)
      .description(description)
      .color(EmbedColors.Warning)
      .footer("Please confirm your action");
  },

  /**
   * Creates a deletion confirmation
   */
  delete(itemName: string, itemIdentifier: string): DiscordEmbedBuilder {
    return createEmbed()
      .title("🗑️ Confirm Deletion")
      .description(
        `Are you sure you want to delete **${itemName}**?\n\n` +
          `\`${itemIdentifier}\`\n\n` +
          `**This action cannot be undone.**`,
      )
      .color(EmbedColors.Error)
      .footer("Please confirm your action");
  },
};
