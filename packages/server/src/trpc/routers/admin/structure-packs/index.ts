import { router } from "@/trpc/trpc";
import { structurePackCrudProcedures } from "./crud";
import { structurePackModProcedures } from "./mods";
import { structurePackRotationProcedures } from "./rotation";

/**
 * Admin Structure Packs Router
 *
 * Manages structure packs and their weekly rotation schedule:
 * - CRUD for structure packs (create, read, update, soft-delete) and import
 * - Mod management: add/remove CurseForge mods, search, and dependency resolution
 * - Rotation control: trigger/clear rotations, history, and schedule config
 */
export const adminStructurePacksRouter = router({
  ...structurePackCrudProcedures,
  ...structurePackModProcedures,
  ...structurePackRotationProcedures,
});
