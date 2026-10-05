import { z } from "zod";
import {
  LAUNCHER_CONTENT_KINDS,
  LAUNCHER_CONTENT_LOADERS,
  LAUNCHER_CONTENT_MAX_PAGE_SIZE,
  LAUNCHER_CONTENT_MAX_RESULTS,
  LAUNCHER_CONTENT_PAGE_SIZE,
  LAUNCHER_CONTENT_PROJECTS_MAX,
  LAUNCHER_CONTENT_SEARCH_MAX_LENGTH,
} from "@createrington/shared/launcher";

const CurseforgeIdSchema = z
  .string()
  .regex(/^[1-9]\d{0,9}$/)
  .transform(Number)
  .refine((id) => id <= 2_147_483_647);

const PageShape = {
  page: z.coerce.number().int().min(0).default(0),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(LAUNCHER_CONTENT_MAX_PAGE_SIZE)
    .default(LAUNCHER_CONTENT_PAGE_SIZE),
};

const TargetShape = {
  minecraftVersion: z
    .string()
    .regex(/^\d+\.\d+(\.\d+)?$/)
    .optional(),
  loader: z.enum(LAUNCHER_CONTENT_LOADERS).optional(),
};

const withinResults = (value: { page: number; limit: number }) =>
  (value.page + 1) * value.limit <= LAUNCHER_CONTENT_MAX_RESULTS;

export const SearchContentQuerySchema = z
  .object({
    query: z
      .string()
      .trim()
      .max(LAUNCHER_CONTENT_SEARCH_MAX_LENGTH)
      .default(""),
    kind: z.enum(LAUNCHER_CONTENT_KINDS).default("mod"),
    ...TargetShape,
    ...PageShape,
  })
  .refine(withinResults, { path: ["page"] });

export type SearchContentQuery = z.infer<typeof SearchContentQuerySchema>;

export const GetProjectsBodySchema = z.object({
  projectIds: z
    .array(CurseforgeIdSchema)
    .min(1)
    .max(LAUNCHER_CONTENT_PROJECTS_MAX),
});

export type GetProjectsBody = z.infer<typeof GetProjectsBodySchema>;

export const ContentIdParamsSchema = z.object({ id: CurseforgeIdSchema });

export type ContentIdParams = z.infer<typeof ContentIdParamsSchema>;

export const ListFilesQuerySchema = z
  .object({ ...TargetShape, ...PageShape })
  .refine(withinResults, { path: ["page"] });

export type ListFilesQuery = z.infer<typeof ListFilesQuerySchema>;
