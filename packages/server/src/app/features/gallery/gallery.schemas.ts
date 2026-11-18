import { z } from "zod";

export const GallerySubmissionParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type GallerySubmissionParams = z.infer<
  typeof GallerySubmissionParamsSchema
>;
