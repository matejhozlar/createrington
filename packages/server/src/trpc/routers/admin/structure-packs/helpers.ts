import { z } from "zod";
import { getService, Services } from "@/services";
import type { StructurePackRotationService } from "@/services/structure-pack/rotation";

// Basename-only: fileName is joined into `path.join(MODS_DIR, fileName)` and SFTP paths.
export const modFileName = z
  .string()
  .min(1)
  .max(200)
  .regex(
    /^[A-Za-z0-9._-]+\.jar$/,
    "fileName must be a basename (no path separators) ending in .jar",
  );

/** Resolves the structure pack rotation service from the DI container */
export async function getRotationService(): Promise<StructurePackRotationService> {
  return getService(Services.STRUCTURE_PACK_ROTATION);
}
