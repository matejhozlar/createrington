import { router } from "./trpc";
import { publicRouter, userRouter, adminRouter } from "./routers";

export const appRouter = router({
  public: publicRouter,
  user: userRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
