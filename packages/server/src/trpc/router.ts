/**
 * Root tRPC router — merges public, user, admin, and consumer sub-routers.
 * `AppRouter` is the exported type consumed by the main client via `@createrington/server/trpc`.
 * Per-consumer sub-routers under `consumers.*` are also exposed via `@createrington/api-types`
 * for external consumer projects (panel, bots).
 */
import { router } from "./trpc";
import {
  publicRouter,
  userRouter,
  adminRouter,
  consumersRouter,
} from "./routers";

export const appRouter = router({
  public: publicRouter,
  user: userRouter,
  admin: adminRouter,
  consumers: consumersRouter,
});

export type AppRouter = typeof appRouter;
