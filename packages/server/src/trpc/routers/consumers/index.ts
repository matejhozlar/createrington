import { router } from "@/trpc/trpc";
import { panelRouter } from "./panel";

/**
 * Root consumer router — aggregates per-consumer sub-routers.
 *
 * Each nested router is a stable, versioned contract intended for one
 * external consumer project (panel, bots, future tools). Procedures reuse
 * the existing auth procedures (`adminProcedure`, etc.); the "consumer"
 * grouping is about API surface and upgrade cadence, not authentication.
 */
export const consumersRouter = router({
  panel: panelRouter,
});
