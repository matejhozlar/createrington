import { z } from "zod";
import {
  LAUNCHER_PACK_RELEASES_MAX_PAGE_SIZE,
  LAUNCHER_PACK_RELEASES_PAGE_SIZE,
  LAUNCHER_PACK_RESOLVE_MAX_FILES,
  LAUNCHER_PACK_SLUG_MAX_LENGTH,
  LAUNCHER_PACK_SLUG_PATTERN,
} from "@createrington/shared/launcher";

const idSchema = z.coerce.number().int().positive().max(2_147_483_647);

export const PackParamsSchema = z.object({
  slug: z
    .string()
    .max(LAUNCHER_PACK_SLUG_MAX_LENGTH)
    .regex(LAUNCHER_PACK_SLUG_PATTERN),
});

export type PackParams = z.infer<typeof PackParamsSchema>;

export const ListReleasesQuerySchema = z.object({
  page: z.coerce.number().int().min(0).max(10_000).default(0),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(LAUNCHER_PACK_RELEASES_MAX_PAGE_SIZE)
    .default(LAUNCHER_PACK_RELEASES_PAGE_SIZE),
});

export type ListReleasesQuery = z.infer<typeof ListReleasesQuerySchema>;

export const ResolveFilesBodySchema = z.object({
  fileIds: z
    .array(z.number().int().positive().max(2_147_483_647))
    .min(1)
    .max(LAUNCHER_PACK_RESOLVE_MAX_FILES),
});

export type ResolveFilesBody = z.infer<typeof ResolveFilesBodySchema>;

export const StorageFileParamsSchema = z.object({
  fileId: idSchema,
});

export type StorageFileParams = z.infer<typeof StorageFileParamsSchema>;

export const StorageSnapshotParamsSchema = z.object({
  id: idSchema,
});

export type StorageSnapshotParams = z.infer<typeof StorageSnapshotParamsSchema>;
