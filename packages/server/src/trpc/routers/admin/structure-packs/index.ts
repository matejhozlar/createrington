import { router } from "@/trpc/trpc";
import { structurePackCrudProcedures } from "./crud";
import { structurePackModProcedures } from "./mods";
import { structurePackRotationProcedures } from "./rotation";

export const adminStructurePacksRouter = router({
  ...structurePackCrudProcedures,
  ...structurePackModProcedures,
  ...structurePackRotationProcedures,
});
