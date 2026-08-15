import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
} from "discord.js";
import { ComponentColors } from "../../colors";
import { discordTimestamp, formatDuration, pluralize } from "@/utils/format";
import type { TopLevelComponent } from "../../component-builder";
import type { PlayerPrompt } from "@createrington/shared/db/player_prompt.types";

const BANNER_URL =
  "https://assets.createrington.com/logo/createrington-woodmark.png";

export interface PlayerPromptTotals {
  entryCount: number;
  responderCount: number;
}

interface ComponentsMessage {
  components: TopLevelComponent[];
  flags: number;
}

function banner(): MediaGalleryBuilder {
  return new MediaGalleryBuilder().addItems(
    new MediaGalleryItemBuilder()
      .setURL(BANNER_URL)
      .setDescription("Createrington"),
  );
}

function divider(): SeparatorBuilder {
  return new SeparatorBuilder()
    .setDivider(true)
    .setSpacing(SeparatorSpacingSize.Small);
}

function text(content: string): TextDisplayBuilder {
  return new TextDisplayBuilder().setContent(content);
}

function heading(prompt: PlayerPrompt, eyebrow?: string): TextDisplayBuilder {
  const lines = eyebrow ? [`-# ${eyebrow}`] : [];
  lines.push(`## ${prompt.question}`);
  if (prompt.description) lines.push(prompt.description);
  return text(lines.join("\n"));
}

function describeRules(prompt: PlayerPrompt): string {
  const parts = [
    prompt.maxEntries === null
      ? "Unlimited entries per player"
      : `Up to ${prompt.maxEntries} ${pluralize(prompt.maxEntries, "entry", "entries")} per player`,
  ];
  if (prompt.cooldownSeconds) {
    const cooldown = formatDuration(
      new Date(0),
      new Date(prompt.cooldownSeconds * 1000),
    );
    parts.push(`${cooldown} between them`);
  }
  return parts.join(" · ");
}

function buttonRow(
  prompt: PlayerPrompt,
  state: "open" | "closed",
): ActionRowBuilder<ButtonBuilder> {
  const isMulti = prompt.entryMode === "multi";
  const button = new ButtonBuilder().setCustomId(`prompt:respond:${prompt.id}`);

  if (state === "open") {
    button
      .setLabel(isMulti ? "Add entry" : "Respond")
      .setStyle(ButtonStyle.Primary);
  } else {
    button
      .setLabel(isMulti ? "Entries closed" : "Responses closed")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true);
  }

  return new ActionRowBuilder<ButtonBuilder>().addComponents(button);
}

/**
 * Wrap the role mention in Discord spoiler tags so the message reads clean
 * while the ping still fires. Components V2 messages can't carry `content`,
 * so the mention rides along as its own top-level text display above the
 * container, where `content` used to sit.
 */
function mentionLine(prompt: PlayerPrompt): TextDisplayBuilder[] {
  return prompt.rolePingId ? [text(`||<@&${prompt.rolePingId}>||`)] : [];
}

/**
 * Components V2 renderings of a player prompt: a gold-striped card while it
 * accepts answers, gray with a disabled button once it closes. Both open with
 * the full-width Createrington woodmark and return the top-level components
 * plus the `IS_COMPONENTS_V2` flag for `messageService.send` / `edit`.
 */
export const PlayerPromptComponentPresets = {
  /** The live announcement: question, closing time, entry rules, respond button. */
  active(prompt: PlayerPrompt): ComponentsMessage {
    const meta = [`**Closes** ${discordTimestamp(prompt.endsAt)}`];
    meta.push(
      prompt.entryMode === "multi"
        ? `**Entries** ${describeRules(prompt)}`
        : "**Entries** One answer per player, editable until it closes",
    );

    const container = new ContainerBuilder()
      .setAccentColor(ComponentColors.Premium)
      .addMediaGalleryComponents(banner())
      .addTextDisplayComponents(heading(prompt))
      .addSeparatorComponents(divider())
      .addTextDisplayComponents(text(meta.join("\n")))
      .addSeparatorComponents(divider())
      .addActionRowComponents(buttonRow(prompt, "open"));

    return {
      components: [...mentionLine(prompt), container],
      flags: MessageFlags.IsComponentsV2,
    };
  },

  /** The post-close card: same question, final tally, disabled button. */
  closed(prompt: PlayerPrompt, totals: PlayerPromptTotals): ComponentsMessage {
    const { entryCount, responderCount } = totals;
    const tally =
      prompt.entryMode === "multi"
        ? `**${entryCount} ${pluralize(entryCount, "entry", "entries")}** from **${responderCount} ${pluralize(responderCount, "player")}**`
        : `**${entryCount} ${pluralize(entryCount, "response")}** received`;

    const container = new ContainerBuilder()
      .setAccentColor(ComponentColors.Neutral)
      .addMediaGalleryComponents(banner())
      .addTextDisplayComponents(heading(prompt, "Closed"))
      .addSeparatorComponents(divider())
      .addTextDisplayComponents(text(tally))
      .addSeparatorComponents(divider())
      .addActionRowComponents(buttonRow(prompt, "closed"));

    return {
      components: [...mentionLine(prompt), container],
      flags: MessageFlags.IsComponentsV2,
    };
  },
};
