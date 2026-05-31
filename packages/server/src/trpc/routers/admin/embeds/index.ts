import { router } from "@/trpc/trpc";
import { embedCrudProcedures } from "./crud";
import { embedLinkedMessageProcedures } from "./linked-messages";
import { embedPresetsRouter } from "./presets";

export const embedsRouter = router({
  ...embedCrudProcedures,
  ...embedLinkedMessageProcedures,
  presets: embedPresetsRouter,
});
