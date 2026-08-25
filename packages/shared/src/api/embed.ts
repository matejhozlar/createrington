import { z } from "zod";

export const embedBotSchema = z.enum(["main", "web"]);
export type EmbedBot = z.infer<typeof embedBotSchema>;

// http(s) only: `z.string().url()` would otherwise accept `javascript:`, `data:`, `file:` schemes.
const httpUrl = z
  .string()
  .max(2048)
  .url()
  .refine((u) => /^https?:\/\//i.test(u), {
    message: "URL must start with http:// or https://",
  });

export const httpUrlSchema = httpUrl;

export const embedFieldSchema = z.object({
  name: z.string().min(1).max(256),
  value: z.string().min(1).max(1024),
  inline: z.boolean().default(false),
});

export const embedLinkButtonSchema = z.object({
  label: z.string().min(1).max(80),
  url: httpUrl,
  emoji: z.string().max(64).optional(),
});

export const embedActionButtonSchema = z.object({
  label: z.string().min(1).max(80),
  emoji: z.string().max(64).optional(),
  action: z.literal("create_thread"),
  channelId: z.string().min(1),
  threadName: z.string().min(1).max(100),
  threadMessage: z.string().min(1).max(2000),
});

export const embedDataSchema = z.object({
  content: z.string().max(2000).optional(),
  title: z.string().max(256).optional(),
  description: z.string().max(4096).optional(),
  color: z.number().int().min(0).max(0xffffff).optional(),
  url: httpUrl.optional().or(z.literal("")),
  fields: z.array(embedFieldSchema).max(25).default([]),
  footer: z.string().max(2048).optional(),
  author: z.string().max(256).optional(),
  authorUrl: httpUrl.optional().or(z.literal("")),
  authorIconUrl: httpUrl.optional().or(z.literal("")),
  thumbnailUrl: httpUrl.optional().or(z.literal("")),
  imageUrl: httpUrl.optional().or(z.literal("")),
  timestamp: z.boolean().default(false),
  buttons: z.array(embedLinkButtonSchema).max(5).default([]),
  actionButtons: z.array(embedActionButtonSchema).max(5).default([]),
});

export type EmbedData = z.infer<typeof embedDataSchema>;
export type EmbedField = z.infer<typeof embedFieldSchema>;
export type EmbedLinkButton = z.infer<typeof embedLinkButtonSchema>;
export type EmbedActionButton = z.infer<typeof embedActionButtonSchema>;

// --- Components V2 ---
// A Components V2 message carries the IS_COMPONENTS_V2 flag and, unlike a
// classic embed, cannot also use plain content or embeds. Containers without
// an accent color render with no left stripe, which classic embeds can never do.

// Discord's hard ceilings for a single Components V2 message.
export const COMPONENTS_V2_MAX_COMPONENTS = 40;
export const COMPONENTS_V2_MAX_TEXT = 4000;

export const componentButtonSchema = z.object({
  type: z.literal("button"),
  label: z.string().min(1).max(80),
  url: httpUrl,
  emoji: z.string().max(64).optional(),
});

export const componentTextDisplaySchema = z.object({
  type: z.literal("text"),
  content: z.string().min(1).max(COMPONENTS_V2_MAX_TEXT),
});

export const componentSeparatorSchema = z.object({
  type: z.literal("separator"),
  divider: z.boolean().default(true),
  spacing: z.union([z.literal(1), z.literal(2)]).default(1),
});

const componentMediaItemSchema = z.object({
  url: httpUrl,
  description: z.string().max(1024).optional(),
  spoiler: z.boolean().default(false),
});

export const componentMediaGallerySchema = z.object({
  type: z.literal("media_gallery"),
  items: z.array(componentMediaItemSchema).min(1).max(10),
});

export const componentThumbnailSchema = z.object({
  type: z.literal("thumbnail"),
  url: httpUrl,
  description: z.string().max(1024).optional(),
  spoiler: z.boolean().default(false),
});

export const componentActionRowSchema = z.object({
  type: z.literal("action_row"),
  components: z.array(componentButtonSchema).min(1).max(5),
});

export const componentSectionSchema = z.object({
  type: z.literal("section"),
  components: z.array(componentTextDisplaySchema).min(1).max(3),
  accessory: z.discriminatedUnion("type", [
    componentThumbnailSchema,
    componentButtonSchema,
  ]),
});

// Containers cannot nest other containers, so the recursion is only one level
// deep and no z.lazy is required.
const containerChildSchema = z.discriminatedUnion("type", [
  componentTextDisplaySchema,
  componentSectionSchema,
  componentMediaGallerySchema,
  componentSeparatorSchema,
  componentActionRowSchema,
]);

export const componentContainerSchema = z.object({
  type: z.literal("container"),
  accentColor: z.number().int().min(0).max(0xffffff).optional(),
  spoiler: z.boolean().default(false),
  components: z
    .array(containerChildSchema)
    .min(1)
    .max(COMPONENTS_V2_MAX_COMPONENTS),
});

export const componentNodeSchema = z.discriminatedUnion("type", [
  componentContainerSchema,
  componentTextDisplaySchema,
  componentSectionSchema,
  componentMediaGallerySchema,
  componentSeparatorSchema,
  componentActionRowSchema,
]);

export const componentsDataSchema = z.object({
  components: z
    .array(componentNodeSchema)
    .min(1)
    .max(COMPONENTS_V2_MAX_COMPONENTS),
});

export type ComponentButton = z.infer<typeof componentButtonSchema>;
export type ComponentTextDisplay = z.infer<typeof componentTextDisplaySchema>;
export type ComponentSeparator = z.infer<typeof componentSeparatorSchema>;
export type ComponentMediaGallery = z.infer<typeof componentMediaGallerySchema>;
export type ComponentThumbnail = z.infer<typeof componentThumbnailSchema>;
export type ComponentActionRow = z.infer<typeof componentActionRowSchema>;
export type ComponentSection = z.infer<typeof componentSectionSchema>;
export type ComponentContainer = z.infer<typeof componentContainerSchema>;
export type ComponentNode = z.infer<typeof componentNodeSchema>;
export type ComponentsData = z.infer<typeof componentsDataSchema>;

export const presetKindSchema = z.enum(["embed", "components"]);
export type PresetKind = z.infer<typeof presetKindSchema>;

// Discriminated payload shared by send, edit, and preset CRUD: a builder
// message is either a classic embed or a Components V2 layout, never both.
export const messagePayloadSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("embed"), embed: embedDataSchema }),
  z.object({ kind: z.literal("components"), components: componentsDataSchema }),
]);
export type MessagePayload = z.infer<typeof messagePayloadSchema>;
