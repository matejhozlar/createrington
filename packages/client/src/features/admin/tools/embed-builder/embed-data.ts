import type { EmbedData, EmbedField } from "@createrington/shared/api/embed";

export interface EmbedFieldInternal extends EmbedField {
  _id: string;
}

export interface EmbedDataInternal extends Omit<EmbedData, "fields"> {
  fields: EmbedFieldInternal[];
}

export interface ActivePreset {
  id: number;
  name: string;
  categoryId: number | null;
}

export const DEFAULT_EMBED: EmbedDataInternal = {
  content: undefined,
  title: undefined,
  description: undefined,
  color: undefined,
  url: undefined,
  fields: [],
  footer: undefined,
  author: undefined,
  authorUrl: undefined,
  authorIconUrl: undefined,
  thumbnailUrl: undefined,
  imageUrl: undefined,
  timestamp: false,
  buttons: [],
  actionButtons: [],
};

function assignFieldIds(fields: EmbedField[]): EmbedFieldInternal[] {
  return fields.map((f) => ({ ...f, _id: crypto.randomUUID() }));
}

function stripFieldIds(fields: EmbedFieldInternal[]): EmbedField[] {
  return fields.map((f) => ({
    name: f.name,
    value: f.value,
    inline: f.inline,
  }));
}

export function toExternalData(data: EmbedDataInternal): EmbedData {
  return { ...data, fields: stripFieldIds(data.fields) };
}

export function normalizeLoadedEmbed(
  loaded: Partial<EmbedData>,
): EmbedDataInternal {
  const raw = loaded as Record<string, unknown>;

  const footer =
    raw.footer && typeof raw.footer === "object" && "text" in raw.footer
      ? (raw.footer as { text: string }).text
      : loaded.footer;

  const author =
    raw.author && typeof raw.author === "object" && "name" in raw.author
      ? (raw.author as { name: string }).name
      : loaded.author;

  const authorUrl =
    raw.author && typeof raw.author === "object" && "url" in raw.author
      ? ((raw.author as { url?: string }).url ?? loaded.authorUrl)
      : loaded.authorUrl;

  const authorIconUrl =
    raw.author && typeof raw.author === "object" && "icon_url" in raw.author
      ? ((raw.author as { icon_url?: string }).icon_url ?? loaded.authorIconUrl)
      : loaded.authorIconUrl;

  return {
    ...DEFAULT_EMBED,
    ...loaded,
    footer,
    author,
    authorUrl,
    authorIconUrl,
    fields: assignFieldIds(loaded.fields ?? []),
  };
}
