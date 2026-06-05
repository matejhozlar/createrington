import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  ThumbnailBuilder,
} from "discord.js";
import {
  COMPONENTS_V2_MAX_COMPONENTS,
  COMPONENTS_V2_MAX_TEXT,
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

function buildTextDisplay(text: ComponentTextDisplay): TextDisplayBuilder {
  return new TextDisplayBuilder().setContent(text.content);
}

function buildSeparator(separator: ComponentSeparator): SeparatorBuilder {
  return new SeparatorBuilder()
    .setDivider(separator.divider)
    .setSpacing(
      separator.spacing === 2
        ? SeparatorSpacingSize.Large
        : SeparatorSpacingSize.Small,
    );
}

function buildThumbnail(thumbnail: ComponentThumbnail): ThumbnailBuilder {
  const builder = new ThumbnailBuilder().setURL(thumbnail.url);
  if (thumbnail.description) builder.setDescription(thumbnail.description);
  if (thumbnail.spoiler) builder.setSpoiler(thumbnail.spoiler);
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

function buildSection(section: ComponentSection): SectionBuilder {
  const builder = new SectionBuilder();
  for (const text of section.components) {
    builder.addTextDisplayComponents(buildTextDisplay(text));
  }
  if (section.accessory.type === "thumbnail") {
    builder.setThumbnailAccessory(buildThumbnail(section.accessory));
  } else {
    builder.setButtonAccessory(buildButton(section.accessory));
  }
  return builder;
}

function buildContainer(container: ComponentContainer): ContainerBuilder {
  const builder = new ContainerBuilder();
  if (container.accentColor !== undefined) {
    builder.setAccentColor(container.accentColor);
  }
  if (container.spoiler) builder.setSpoiler(container.spoiler);
  for (const child of container.components) {
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
      const text = node.components.reduce(
        (sum, t) => sum + t.content.length,
        0,
      );
      // Each text display + the accessory each count as a component.
      return { count: 1 + node.components.length + 1, text };
    }
    case "container": {
      let count = 1;
      let text = 0;
      for (const child of node.components) {
        const child_measure = measure(child);
        count += child_measure.count;
        text += child_measure.text;
      }
      return { count, text };
    }
  }
}

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
