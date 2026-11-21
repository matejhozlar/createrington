import { router } from "@/trpc/trpc";
import { embedCrudProcedures } from "./crud";
import { embedPresetsRouter } from "./presets";

export const embedsRouter = router({
  ...embedCrudProcedures,
  presets: embedPresetsRouter,
});
