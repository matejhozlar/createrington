import { router } from "@/trpc/trpc";
import { sandboxPlayersRouter } from "./players";
import { sandboxWorkshopsRouter } from "./workshops";

/**
 * Sandbox consumer router.
 *
 * Exposed to the sandbox admin panel (separate project) over HTTP.
 * Authentication reuses `adminProcedure`: the sandbox forwards the user's
 * JWT as `Authorization: Bearer <token>`. The sandbox enforces its own RBAC
 * *before* calling this router; the main app only verifies "valid admin user".
 *
 * Consumer-facing type export lives in `@createrington/api-types`.
 */
export const sandboxRouter = router({
  players: sandboxPlayersRouter,
  workshops: sandboxWorkshopsRouter,
});

export type SandboxRouter = typeof sandboxRouter;
