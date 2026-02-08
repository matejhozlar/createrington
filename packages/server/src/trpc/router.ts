import { router } from "./trpc";
import {
  serversRouter,
  playersRouter,
  waitlistsRouter,
  metricsRouter,
  adminRouter,
} from "./routers";

export const appRouter = router({
  servers: serversRouter,
  players: playersRouter,
  waitlists: waitlistsRouter,
  metrics: metricsRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
