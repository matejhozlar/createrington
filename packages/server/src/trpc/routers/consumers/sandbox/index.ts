import { router } from "@/trpc/trpc";
import { sandboxPlayersRouter } from "./players";
import { sandboxWorkshopsRouter } from "./workshops";
import { sandboxModsRouter } from "./mods";
import { sandboxModpacksRouter } from "./modpacks";

/**
 * Sandbox consumer router.
 *
 * Exposed to the sandbox admin panel (separate project) over HTTP.
 * Authentication reuses `adminProcedure`: the sandbox forwards the user's
 * JWT as `Authorization: Bearer <token>`. The sandbox enforces its own RBAC
 * *before* calling this router; the main app only verifies "valid admin user".
 * `modpacks.recordPublish` is the one exception: the sandbox server calls it
 * from a background job and authenticates with the shared service token
 * (`sandboxServiceProcedure`).
 *
 * Consumer-facing type export lives in `@createrington/api-types`.
 */
export const sandboxRouter = router({
  players: sandboxPlayersRouter,
  workshops: sandboxWorkshopsRouter,
  mods: sandboxModsRouter,
  modpacks: sandboxModpacksRouter,
});

export type SandboxRouter = typeof sandboxRouter;
