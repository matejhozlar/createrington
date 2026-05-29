import { router } from "@/trpc/trpc";
import { embedCrudProcedures } from "./crud";
import { embedLinkedMessageProcedures } from "./linked-messages";
import { embedPresetsRouter } from "./presets";

/** Admin embeds router: send/edit Discord embeds, linked-message wiring, and preset management. */
export const embedsRouter = router({
  ...embedCrudProcedures,
  ...embedLinkedMessageProcedures,
  presets: embedPresetsRouter,
});
