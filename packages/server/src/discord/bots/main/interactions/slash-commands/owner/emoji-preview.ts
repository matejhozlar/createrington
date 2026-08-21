/**
 * TODELETE - throwaway command for eyeballing custom emojis on dev
 *
 * Exists only to answer "how does this actually look in Discord", which the
 * deploy logs and the Developer Portal cannot show: emojis render at different
 * sizes inline, in embeds and on buttons, and stroke weight either survives that
 * or does not. Registered as "dev" in the command registry, so it never reaches
 * production. Delete this file and its registry entry once the manifest's
 * appearance is settled.
 */

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import config from "@/config";
import { EmbedPresets } from "@/discord/embeds";
import { emojiManifest, type EmojiKey } from "@/discord/emojis/manifest";
import { resolveEmoji } from "@/discord/emojis/registry";

export const data = new SlashCommandBuilder()
  .setName("emoji-preview")
  .setDescription("TEMP: preview how custom emojis render (dev only)")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((option) =>
    option
      .setName("emoji")
      .setDescription("Which manifest entry to preview")
      .setRequired(false)
      .addChoices(
        ...Object.keys(emojiManifest)
          .slice(0, 25)
          .map((name) => ({ name, value: name })),
      ),
  );

export const permissions = {
  requireOwner: true,
};

/** Every button style that accepts an emoji and needs no URL */
const STYLES = [
  { label: "Primary", style: ButtonStyle.Primary },
  { label: "Secondary", style: ButtonStyle.Secondary },
  { label: "Success", style: ButtonStyle.Success },
  { label: "Danger", style: ButtonStyle.Danger },
] as const;

/**
 * Renders every context a custom emoji can appear in
 *
 * @param interaction - The chat input command interaction
 * @returns Promise resolving when the preview has been sent
 */
export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const keys = Object.keys(emojiManifest) as EmojiKey[];
  const selected = (interaction.options.getString("emoji") ??
    keys[0]) as EmojiKey;

  if (!keys.includes(selected)) {
    await interaction.reply({
      content: `No manifest entry named \`${selected}\`.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const emoji = resolveEmoji(selected);
  const fallback = emojiManifest[selected].fallback;
  const isCustom = emoji !== fallback;

  const embed = EmbedPresets.info(`${emoji} Emoji preview: ${selected}`)
    .field("In an embed field", `${emoji} beside text`, true)
    .field("Unicode fallback", `${fallback} beside text`, true)
    .field(
      "Resolved as",
      isCustom
        ? `custom emoji \`${emoji}\``
        : `**fallback** - not deployed to this application`,
      false,
    )
    .field(
      "All manifest entries",
      keys.map((key) => `${resolveEmoji(key)} \`${key}\``).join("\n"),
      false,
    )
    .timestamp()
    .build();

  const labelled = new ActionRowBuilder<ButtonBuilder>().addComponents(
    STYLES.map((variant) =>
      new ButtonBuilder()
        .setCustomId(`emoji_preview_labelled_${variant.label}`)
        .setLabel(variant.label)
        .setStyle(variant.style)
        .setEmoji(emoji),
    ),
  );

  const iconOnly = new ActionRowBuilder<ButtonBuilder>().addComponents(
    STYLES.map((variant) =>
      new ButtonBuilder()
        .setCustomId(`emoji_preview_icon_${variant.label}`)
        .setStyle(variant.style)
        .setEmoji(emoji),
    ),
  );

  // Unicode alongside custom, so the two can be compared for size and baseline
  const comparison = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("emoji_preview_custom")
      .setLabel("Custom")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(emoji),
    new ButtonBuilder()
      .setCustomId("emoji_preview_fallback")
      .setLabel("Fallback")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(fallback),
    new ButtonBuilder()
      .setCustomId("emoji_preview_disabled")
      .setLabel("Disabled")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(emoji)
      .setDisabled(true),
    new ButtonBuilder()
      .setLabel("Link")
      .setStyle(ButtonStyle.Link)
      .setURL(config.meta.links.website)
      .setEmoji(emoji),
  );

  const select = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("emoji_preview_select")
      .setPlaceholder("Select menu options")
      .addOptions(
        keys
          .slice(0, 25)
          .map((key) =>
            new StringSelectMenuOptionBuilder()
              .setLabel(key)
              .setValue(key)
              .setDescription(`fallback ${emojiManifest[key].fallback}`)
              .setEmoji(resolveEmoji(key)),
          ),
      ),
  );

  await interaction.reply({
    content: [
      `Inline in message content: ${emoji} beside text`,
      `Repeated: ${emoji}${emoji}${emoji}`,
      `Against unicode: ${emoji} custom / ${fallback} fallback`,
      "",
      "_Buttons are inert; nothing handles these interactions._",
    ].join("\n"),
    embeds: [embed],
    components: [labelled, iconOnly, comparison, select],
    flags: MessageFlags.Ephemeral,
  });

  // A message whose content is only emoji renders at jumbo size
  await interaction.followUp({
    content: `${emoji}${emoji}${emoji}`,
    flags: MessageFlags.Ephemeral,
  });
}
