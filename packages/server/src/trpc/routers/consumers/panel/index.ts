import { router } from "@/trpc/trpc";
import { panelPresenceRouter } from "./presence";

/**
 * Panel consumer router.
 *
 * Exposed to the admin panel (separate project) over HTTP. Authentication
 * reuses `adminProcedure`: the panel forwards the user's JWT as
 * `Authorization: Bearer <token>`. The panel enforces its own RBAC *before*
 * calling this router; the main app only verifies "valid admin user".
 *
 * Consumer-facing type export lives in `@createrington/api-types`.
 */
export const panelRouter = router({
  presence: panelPresenceRouter,
});

export type PanelRouter = typeof panelRouter;
