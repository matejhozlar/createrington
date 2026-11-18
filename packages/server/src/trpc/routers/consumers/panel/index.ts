import { router } from "@/trpc/trpc";
import { panelPresenceRouter } from "./presence";

export const panelRouter = router({
  presence: panelPresenceRouter,
});

export type PanelRouter = typeof panelRouter;
