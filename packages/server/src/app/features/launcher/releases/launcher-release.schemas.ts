import { z } from "zod";
import {
  LAUNCHER_CHANNELS,
  LAUNCHER_PLATFORMS,
  LAUNCHER_RELEASE_NOTES_MAX_LENGTH,
} from "@createrington/shared/launcher";

export const PublishReleaseBodySchema = z.object({
  channel: z.enum(LAUNCHER_CHANNELS),
  version: z.string().min(1).max(64),
  platform: z.enum(LAUNCHER_PLATFORMS),
  url: z.string().url().max(2048),
  signature: z.string().min(1).max(4096),
  notes: z.string().max(LAUNCHER_RELEASE_NOTES_MAX_LENGTH).default(""),
  structuredNotes: z.unknown().optional(),
  pubDate: z.coerce.date(),
});

export type PublishReleaseBody = z.infer<typeof PublishReleaseBodySchema>;
