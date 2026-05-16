import { z } from "zod";

export const embedBotSchema = z.enum(["main", "web"]);
export type EmbedBot = z.infer<typeof embedBotSchema>;

// http(s) only: `z.string().url()` would otherwise accept `javascript:`, `data:`, `file:` schemes.
const httpUrl = z
  .string()
  .url()
  .refine((u) => /^https?:\/\//i.test(u), {
    message: "URL must start with http:// or https://",
  });

export const embedFieldSchema = z.object({
  name: z.string().min(1).max(256),
  value: z.string().min(1).max(1024),
  inline: z.boolean().default(false),
});

export const embedLinkButtonSchema = z.object({
  label: z.string().min(1).max(80),
  url: httpUrl,
  emoji: z.string().max(32).optional(),
});

export const embedActionButtonSchema = z.object({
  label: z.string().min(1).max(80),
  emoji: z.string().max(32).optional(),
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
