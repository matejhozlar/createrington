import { router } from "@/trpc/trpc";
import { structurePackCrudProcedures } from "./crud";
import { structurePackModsRouter } from "./mods";
import { structurePackRotationRouter } from "./rotation";

export const adminStructurePacksRouter = router({
  ...structurePackCrudProcedures,
  mods: structurePackModsRouter,
  rotation: structurePackRotationRouter,
});
