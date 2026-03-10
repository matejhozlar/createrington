/**
 * Root tRPC router — merges public, user, and admin sub-routers.
 * `AppRouter` is the exported type consumed by the client via `@createrington/server/trpc`.
 */
import { router } from "./trpc";
import { publicRouter, userRouter, adminRouter } from "./routers";

export const appRouter = router({
  public: publicRouter,
  user: userRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
