import { router } from "./trpc";
import {
  publicRouter,
  userRouter,
  adminRouter,
  ownerRouter,
  consumersRouter,
} from "./routers";

export const appRouter = router({
  public: publicRouter,
  user: userRouter,
  admin: adminRouter,
  owner: ownerRouter,
  consumers: consumersRouter,
});

export type AppRouter = typeof appRouter;
