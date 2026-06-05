import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  ThumbnailBuilder,
} from "discord.js";
import {
  COMPONENTS_V2_MAX_COMPONENTS,
  COMPONENTS_V2_MAX_TEXT,
  componentsDataSchema,
  type ComponentActionRow,
  type ComponentButton,
  type ComponentContainer,
  type ComponentMediaGallery,
  type ComponentNode,
  type ComponentSection,
  type ComponentSeparator,
  type ComponentTextDisplay,
  type ComponentThumbnail,
  type ComponentsData,
} from "@createrington/shared/api/embed";

export type TopLevelComponent =
  | ContainerBuilder
  | ActionRowBuilder<ButtonBuilder>
  | SectionBuilder
  | TextDisplayBuilder
  | MediaGalleryBuilder
  | SeparatorBuilder;

function buildButton(button: ComponentButton): ButtonBuilder {
  const builder = new ButtonBuilder()
    .setStyle(ButtonStyle.Link)
    .setLabel(button.label)
    .setURL(button.url);
  if (button.emoji) builder.setEmoji(button.emoji);
  return builder;
}

function buildTextDisplay(node: ComponentTextDisplay): TextDisplayBuilder {
  return new TextDisplayBuilder().setContent(node.content);
}

function buildSeparator(node: ComponentSeparator): SeparatorBuilder {
  return new SeparatorBuilder()
    .setDivider(node.divider)
    .setSpacing(
      node.spacing === 2
        ? SeparatorSpacingSize.Large
        : SeparatorSpacingSize.Small,
    );
}

function buildThumbnail(node: ComponentThumbnail): ThumbnailBuilder {
  const builder = new ThumbnailBuilder().setURL(node.url);
  if (node.description) builder.setDescription(node.description);
  if (node.spoiler) builder.setSpoiler(node.spoiler);
  return builder;
}

function buildMediaGallery(
  gallery: ComponentMediaGallery,
): MediaGalleryBuilder {
  const builder = new MediaGalleryBuilder();
  for (const item of gallery.items) {
    const mediaItem = new MediaGalleryItemBuilder().setURL(item.url);
    if (item.description) mediaItem.setDescription(item.description);
    if (item.spoiler) mediaItem.setSpoiler(item.spoiler);
    builder.addItems(mediaItem);
  }
  return builder;
}

function buildActionRow(
  row: ComponentActionRow,
): ActionRowBuilder<ButtonBuilder> {
  const builder = new ActionRowBuilder<ButtonBuilder>();
  for (const button of row.components)
    builder.addComponents(buildButton(button));
  return builder;
}

function buildSection(node: ComponentSection): SectionBuilder {
  const builder = new SectionBuilder();
  for (const textNode of node.components) {
    builder.addTextDisplayComponents(buildTextDisplay(textNode));
  }
  if (node.accessory.type === "thumbnail") {
    builder.setThumbnailAccessory(buildThumbnail(node.accessory));
  } else {
    builder.setButtonAccessory(buildButton(node.accessory));
  }
  return builder;
}

function buildContainer(node: ComponentContainer): ContainerBuilder {
  const builder = new ContainerBuilder();
  if (node.accentColor !== undefined) {
    builder.setAccentColor(node.accentColor);
  }
  if (node.spoiler) builder.setSpoiler(node.spoiler);
  for (const child of node.components) {
    switch (child.type) {
      case "text":
        builder.addTextDisplayComponents(buildTextDisplay(child));
        break;
      case "section":
        builder.addSectionComponents(buildSection(child));
        break;
      case "media_gallery":
        builder.addMediaGalleryComponents(buildMediaGallery(child));
        break;
      case "separator":
        builder.addSeparatorComponents(buildSeparator(child));
        break;
      case "action_row":
        builder.addActionRowComponents(buildActionRow(child));
        break;
    }
  }
  return builder;
}

/** Translate a validated Components V2 tree into top-level discord.js builders. */
export function buildComponentsV2(data: ComponentsData): TopLevelComponent[] {
  return data.components.map((node) => {
    switch (node.type) {
      case "container":
        return buildContainer(node);
      case "text":
        return buildTextDisplay(node);
      case "section":
        return buildSection(node);
      case "media_gallery":
        return buildMediaGallery(node);
      case "separator":
        return buildSeparator(node);
      case "action_row":
        return buildActionRow(node);
    }
  });
}

type AnyComponentNode =
  | ComponentNode
  | ComponentContainer["components"][number];

function measure(node: AnyComponentNode): { count: number; text: number } {
  switch (node.type) {
    case "text":
      return { count: 1, text: node.content.length };
    case "separator":
      return { count: 1, text: 0 };
    case "media_gallery":
      return { count: 1 + node.items.length, text: 0 };
    case "action_row":
      return { count: 1 + node.components.length, text: 0 };
    case "section": {
      const textLength = node.components.reduce(
        (sum, t) => sum + t.content.length,
        0,
      );
      // Each text display + the accessory each count as a component.
      return { count: 1 + node.components.length + 1, text: textLength };
    }
    case "container": {
      let count = 1;
      let textLength = 0;
      for (const child of node.components) {
        const childMeasure = measure(child);
        count += childMeasure.count;
        textLength += childMeasure.text;
      }
      return { count, text: textLength };
    }
  }
}

/** Enforce Discord's aggregate component/text ceilings; returns an error string or null. */
export function validateComponentsV2(data: ComponentsData): string | null {
  if (data.components.length === 0) {
    return "Add at least one component";
  }

  let count = 0;
  let text = 0;
  for (const node of data.components) {
    const result = measure(node);
    count += result.count;
    text += result.text;
  }

  if (count > COMPONENTS_V2_MAX_COMPONENTS) {
    return `Too many components (${count}/${COMPONENTS_V2_MAX_COMPONENTS})`;
  }
  if (text > COMPONENTS_V2_MAX_TEXT) {
    return `Too much text (${text}/${COMPONENTS_V2_MAX_TEXT} characters)`;
  }

  return null;
}

export function text(content: string): ComponentTextDisplay {
  return { type: "text", content };
}

export function separator(
  options: { divider?: boolean; spacing?: 1 | 2 } = {},
): ComponentSeparator {
  return {
    type: "separator",
    divider: options.divider ?? true,
    spacing: options.spacing ?? 1,
  };
}

export function linkButton(
  label: string,
  url: string,
  emoji?: string,
): ComponentButton {
  return emoji
    ? { type: "button", label, url, emoji }
    : { type: "button", label, url };
}

export function thumbnail(
  url: string,
  options: { description?: string; spoiler?: boolean } = {},
): ComponentThumbnail {
  return {
    type: "thumbnail",
    url,
    ...(options.description !== undefined && {
      description: options.description,
    }),
    spoiler: options.spoiler ?? false,
  };
}

export function mediaGallery(
  items: Array<{ url: string; description?: string; spoiler?: boolean }>,
): ComponentMediaGallery {
  return {
    type: "media_gallery",
    items: items.map((item) => ({
      url: item.url,
      ...(item.description !== undefined && { description: item.description }),
      spoiler: item.spoiler ?? false,
    })),
  };
}

export function actionRow(buttons: ComponentButton[]): ComponentActionRow {
  return { type: "action_row", components: buttons };
}

export function section(
  texts: Array<string | ComponentTextDisplay>,
  accessory: ComponentSection["accessory"],
): ComponentSection {
  return {
    type: "section",
    components: texts.map((t) => (typeof t === "string" ? text(t) : t)),
    accessory,
  };
}

export function container(
  children: ComponentContainer["components"],
  options: { accentColor?: number; spoiler?: boolean } = {},
): ComponentContainer {
  return {
    type: "container",
    ...(options.accentColor !== undefined && {
      accentColor: options.accentColor,
    }),
    spoiler: options.spoiler ?? false,
    components: children,
  };
}

/**
 * Validate a data-first Components V2 tree and produce send-ready pieces.
 * Applies schema defaults, enforces the aggregate limits, and returns the
 * top-level builders plus the `IS_COMPONENTS_V2` flag for `messageService.send`.
 * Throws if the tree is invalid (a programming error for in-code callers).
 */
export function buildComponentsMessage(data: ComponentsData): {
  components: TopLevelComponent[];
  flags: number;
} {
  const parsed = componentsDataSchema.parse(data);
  const error = validateComponentsV2(parsed);
  if (error) {
    throw new Error(`Invalid Components V2 message: ${error}`);
  }
  return {
    components: buildComponentsV2(parsed),
    flags: MessageFlags.IsComponentsV2,
  };
}
