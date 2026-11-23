import { z } from "zod";
import { httpUrlSchema } from "./api/embed";

export const structurePackModFileName = z
  .string()
  .min(1)
  .max(200)
  .regex(
    /^[A-Za-z0-9._-]+\.jar$/,
    "fileName must be a basename (no path separators) ending in .jar",
  );

export const structurePackImportSchema = z.object({
  structurePacks: z.array(
    z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(500).nullish(),
      enabled: z.boolean().optional().default(true),
      mods: z.array(
        z.object({
          curseforgeModId: z.number().int().positive(),
          curseforgeFileId: z.number().int().positive(),
          fileName: structurePackModFileName,
          modName: z.string().min(1),
          modUrl: httpUrlSchema.nullish(),
          thumbnailUrl: z.string().url().nullish(),
        }),
      ),
    }),
  ),
});

export type StructurePackImport = z.infer<typeof structurePackImportSchema>;
export type StructurePackImportEntry =
  StructurePackImport["structurePacks"][number];
