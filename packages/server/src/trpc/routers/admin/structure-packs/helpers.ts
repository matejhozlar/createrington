import { getService, Services } from "@/services";
import type { StructurePackRotationService } from "@/services/structure-pack/rotation/rotation.service";

export async function getRotationService(): Promise<StructurePackRotationService> {
  return getService(Services.STRUCTURE_PACK_ROTATION);
}
