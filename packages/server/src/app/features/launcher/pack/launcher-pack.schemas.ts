import { z } from "zod";
import { LAUNCHER_PACK_RESOLVE_MAX_FILES } from "@createrington/shared/launcher";

export const ResolveFilesBodySchema = z.object({
  fileIds: z
    .array(z.number().int().positive().max(2_147_483_647))
    .min(1)
    .max(LAUNCHER_PACK_RESOLVE_MAX_FILES),
});

export type ResolveFilesBody = z.infer<typeof ResolveFilesBodySchema>;
