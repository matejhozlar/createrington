import { z } from "zod";

export const embedBotSchema = z.enum(["main", "web"]);
export type EmbedBot = z.infer<typeof embedBotSchema>;

export const embedFieldSchema = z.object({
  name: z.string().min(1).max(256),
  value: z.string().min(1).max(1024),
  inline: z.boolean().default(false),
});

export const embedDataSchema = z.object({
  title: z.string().max(256).optional(),
  description: z.string().max(4096).optional(),
  color: z.number().int().min(0).max(0xffffff).optional(),
  url: z.string().url().optional().or(z.literal("")),
  fields: z.array(embedFieldSchema).max(25).default([]),
  footer: z.string().max(2048).optional(),
  author: z.string().max(256).optional(),
  authorUrl: z.string().url().optional().or(z.literal("")),
  authorIconUrl: z.string().url().optional().or(z.literal("")),
  thumbnailUrl: z.string().url().optional().or(z.literal("")),
  imageUrl: z.string().url().optional().or(z.literal("")),
  timestamp: z.boolean().default(false),
});

export type EmbedData = z.infer<typeof embedDataSchema>;
export type EmbedField = z.infer<typeof embedFieldSchema>;
