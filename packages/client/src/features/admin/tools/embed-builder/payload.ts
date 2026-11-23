import { z } from "zod";
import type {
  ComponentNode,
  EmbedData,
  MessagePayload,
  PresetKind,
} from "@createrington/shared/api/embed";

export const DEFAULT_EMBED: EmbedData = {
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

const text = z.string().catch("");
const optionalText = z.string().optional().catch(undefined);
const flag = z.boolean().catch(false);
const color = z.number().int().min(0).max(0xffffff).optional().catch(undefined);

const editableEmbedSchema = z.object({
  content: optionalText,
  title: optionalText,
  description: optionalText,
  color,
  url: optionalText,
  fields: z
    .array(z.object({ name: text, value: text, inline: flag }))
    .catch([]),
  footer: optionalText,
  author: optionalText,
  authorUrl: optionalText,
  authorIconUrl: optionalText,
  thumbnailUrl: optionalText,
  imageUrl: optionalText,
  timestamp: flag,
  buttons: z
    .array(z.object({ label: text, url: text, emoji: optionalText }))
    .catch([]),
  actionButtons: z
    .array(
      z.object({
        label: text,
        emoji: optionalText,
        action: z.literal("create_thread").catch("create_thread"),
        channelId: text,
        threadName: text,
        threadMessage: text,
      }),
    )
    .catch([]),
});

const editableButton = z.object({
  type: z.literal("button"),
  label: text,
  url: text,
  emoji: optionalText,
});
const editableText = z.object({ type: z.literal("text"), content: text });
const editableSeparator = z.object({
  type: z.literal("separator"),
  divider: z.boolean().catch(true),
  spacing: z.union([z.literal(1), z.literal(2)]).catch(1),
});
const editableGallery = z.object({
  type: z.literal("media_gallery"),
  items: z.array(
    z.object({ url: text, description: optionalText, spoiler: flag }),
  ),
});
const editableActionRow = z.object({
  type: z.literal("action_row"),
  components: z.array(editableButton),
});
const editableSection = z.object({
  type: z.literal("section"),
  components: z.array(editableText),
  accessory: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("thumbnail"),
      url: text,
      description: optionalText,
      spoiler: flag,
    }),
    editableButton,
  ]),
});
const editableChild = z.discriminatedUnion("type", [
  editableText,
  editableSection,
  editableGallery,
  editableSeparator,
  editableActionRow,
]);
const editableTreeSchema = z.array(
  z.discriminatedUnion("type", [
    z.object({
      type: z.literal("container"),
      accentColor: color,
      spoiler: flag,
      components: z.array(editableChild),
    }),
    editableText,
    editableSection,
    editableGallery,
    editableSeparator,
    editableActionRow,
  ]),
);

function nested(
  raw: Record<string, unknown>,
  key: string,
  inner: string,
): unknown {
  const value = raw[key];
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)[inner]
    : undefined;
}

function flattenDiscordEmbed(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  return {
    ...r,
    footer: nested(r, "footer", "text") ?? r.footer,
    author: nested(r, "author", "name") ?? r.author,
    authorUrl: nested(r, "author", "url") ?? r.authorUrl,
    authorIconUrl: nested(r, "author", "icon_url") ?? r.authorIconUrl,
    imageUrl: nested(r, "image", "url") ?? r.imageUrl,
    thumbnailUrl: nested(r, "thumbnail", "url") ?? r.thumbnailUrl,
  };
}

export function parseEmbed(raw: unknown): EmbedData {
  return {
    ...DEFAULT_EMBED,
    ...editableEmbedSchema.parse(flattenDiscordEmbed(raw)),
  };
}

export function parseComponents(raw: unknown): ComponentNode[] | null {
  return editableTreeSchema.safeParse(raw).data ?? null;
}

export function parsePayload(
  kind: PresetKind,
  data: unknown,
): MessagePayload | null {
  if (kind === "embed") return { kind, embed: parseEmbed(data) };
  const components =
    data && typeof data === "object" && "components" in data
      ? parseComponents(data.components)
      : null;
  return components ? { kind, components: { components } } : null;
}

export function snapshotOf(payload: MessagePayload): string {
  return JSON.stringify(
    payload.kind === "components" ? payload.components : payload.embed,
  );
}

export function payloadHasContent(payload: MessagePayload): boolean {
  if (payload.kind === "components") {
    return payload.components.components.length > 0;
  }
  const { content, title, description, fields } = payload.embed;
  return !!(content || title || description || fields.length > 0);
}
